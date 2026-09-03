import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../src/config/prisma.js'
import { acceptGameInvite, createGameLobby, getGameLobby, listGameInvites, rejectGameInvite } from '../src/services/gameLobbyService.js'

test('les invitations et salons 1v1/1v1v1 appliquent les règles sociales', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({
    data: [
      { email: `lobby-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Lobby A ${suffix}` },
      { email: `lobby-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Lobby B ${suffix}` },
      { email: `lobby-c-${suffix}@example.test`, passwordHash: 'test', displayName: `Lobby C ${suffix}` },
      { email: `lobby-d-${suffix}@example.test`, passwordHash: 'test', displayName: `Lobby D ${suffix}` },
    ],
    select: { id: true },
  })
  const [creator, opponent, third, outsider] = users

  try {
    await assert.rejects(() => createGameLobby(creator!.id, '1v1', [creator!.id]), /distincts et différents/)
    const oneVsOne = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    assert.equal(oneVsOne?.players.length, 2)
    assert.equal(oneVsOne?.status, 'WAITING')
    assert.equal((await listGameInvites(opponent!.id)).length, 1)
    await assert.rejects(() => createGameLobby(creator!.id, '1v1', [opponent!.id]), /déjà en attente/)
    await assert.rejects(() => acceptGameInvite(outsider!.id, oneVsOne!.players[1]!.inviteId!), /introuvable/)
    await rejectGameInvite(opponent!.id, oneVsOne!.players[1]!.inviteId!)

    const threeWay = await createGameLobby(creator!.id, '1v1v1', [opponent!.id, third!.id])
    assert.equal(threeWay?.players.length, 3)
    assert.equal(threeWay?.players[1]?.status, 'PENDING')
    await acceptGameInvite(opponent!.id, threeWay!.players[1]!.inviteId!)
    const waiting = await getGameLobby(creator!.id, threeWay!.id)
    assert.equal(waiting?.status, 'WAITING')
    await assert.rejects(() => getGameLobby(outsider!.id, threeWay!.id), /ne participez pas/)
    await acceptGameInvite(third!.id, threeWay!.players[2]!.inviteId!)
    assert.equal((await getGameLobby(creator!.id, threeWay!.id))?.status, 'READY')
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})
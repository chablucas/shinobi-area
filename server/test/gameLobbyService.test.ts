import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../src/config/prisma.js'
import { acceptGameInvite, createGameLobby, getGameLobby, listGameInvites, rejectGameInvite, startGameLobby } from '../src/services/gameLobbyService.js'

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

test('le 1v1v1 humain + humain + IA ne crée aucune invitation ni utilisateur factice pour l’IA', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({
    data: [
      { email: `lobby-ai-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Lobby AI A ${suffix}` },
      { email: `lobby-ai-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Lobby AI B ${suffix}` },
    ],
    select: { id: true },
  })
  const [creator, friend] = users
  const countUsersBefore = await prisma.user.count()

  try {
    await assert.rejects(() => createGameLobby(creator!.id, '1v1v1', [friend!.id, 999999], true), /correspond pas au mode/)
    const lobby = await createGameLobby(creator!.id, '1v1v1', [friend!.id], true)
    assert.equal(lobby?.includesAi, true)
    assert.equal(lobby?.players.length, 3)
    const aiPlayer = lobby!.players.find((player) => player.isAi)
    assert.ok(aiPlayer)
    assert.equal(aiPlayer!.id, null)
    assert.equal(aiPlayer!.status, 'ACCEPTED')
    assert.equal(aiPlayer!.inviteId, null)
    const humanInvites = lobby!.players.filter((player) => !player.isAi && player.id !== creator!.id)
    assert.equal(humanInvites.length, 1)
    assert.equal(await prisma.user.count(), countUsersBefore)
    assert.equal(lobby?.status, 'WAITING')
    assert.equal((await getGameLobby(creator!.id, lobby!.id))?.status, 'WAITING')
    await acceptGameInvite(friend!.id, humanInvites[0]!.inviteId!)
    const ready = await getGameLobby(creator!.id, lobby!.id)
    assert.equal(ready?.status, 'READY')
    assert.ok(ready?.players.some((player) => player.isAi))
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('le démarrage exige un lobby READY et le créateur, puis autorise les participants', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({
    data: [
      { email: `lobby-start-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Lobby Start A ${suffix}` },
      { email: `lobby-start-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Lobby Start B ${suffix}` },
      { email: `lobby-start-c-${suffix}@example.test`, passwordHash: 'test', displayName: `Lobby Start C ${suffix}` },
    ],
    select: { id: true },
  })
  const [creator, opponent, outsider] = users

  try {
    const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    await assert.rejects(() => startGameLobby(creator!.id, lobby!.id), /pas prêt/)
    await assert.rejects(() => startGameLobby(999999, lobby!.id), /créateur/)
    await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
    assert.equal((await getGameLobby(creator!.id, lobby!.id))?.status, 'READY')
    await assert.rejects(() => startGameLobby(999999, lobby!.id), /créateur/)
    const started = await startGameLobby(creator!.id, lobby!.id)
    assert.equal(started?.status, 'PLAYING')
    await assert.doesNotReject(() => getGameLobby(opponent!.id, lobby!.id))
    assert.equal((await startGameLobby(creator!.id, lobby!.id))?.status, 'PLAYING')
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})
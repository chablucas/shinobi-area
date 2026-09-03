import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../src/config/prisma.js'
import { acceptFriendRequest, cancelFriendRequest, listFriendRequests, listFriends, rejectFriendRequest, removeFriend, searchUsers, sendFriendRequest } from '../src/services/friendshipService.js'
import { globalSearch } from '../src/services/searchService.js'

test('les demandes d’amis couvrent le cycle, les doublons et les autorisations', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({
    data: [
      { email: `social-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Social A ${suffix}` },
      { email: `social-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Social B ${suffix}` },
      { email: `social-c-${suffix}@example.test`, passwordHash: 'test', displayName: `Social C ${suffix}` },
    ],
    select: { id: true, displayName: true },
  })
  const [alice, bob, carol] = users

  try {
    await assert.rejects(() => sendFriendRequest(alice!.id, alice!.id), /autre utilisateur valide/)
    const sent = await sendFriendRequest(alice!.id, bob!.id)
    assert.equal(sent.receiver.id, bob!.id)
    assert.equal((await listFriendRequests(bob!.id, 'received')).length, 1)
    assert.equal((await listFriendRequests(alice!.id, 'sent')).length, 1)
    await assert.rejects(() => sendFriendRequest(bob!.id, alice!.id), /demande est déjà en attente/)
    await assert.rejects(() => acceptFriendRequest(alice!.id, sent.id), /introuvable/)
    await acceptFriendRequest(bob!.id, sent.id)
    assert.deepEqual((await listFriends(alice!.id)).map((friend) => friend.id), [bob!.id])
    await assert.rejects(() => sendFriendRequest(alice!.id, bob!.id), /déjà amis/)
    await removeFriend(alice!.id, bob!.id)
    assert.deepEqual(await listFriends(alice!.id), [])

    const rejected = await sendFriendRequest(alice!.id, carol!.id)
    await rejectFriendRequest(carol!.id, rejected.id)
    assert.deepEqual(await listFriendRequests(carol!.id, 'received'), [])
    const resent = await sendFriendRequest(alice!.id, carol!.id)
    await cancelFriendRequest(alice!.id, resent.id)
    await assert.rejects(() => rejectFriendRequest(alice!.id, resent.id), /introuvable/)

    const playerResults = await searchUsers(alice!.id, 'social b')
    assert.equal(playerResults[0]?.displayName, bob!.displayName)
    assert.equal('email' in playerResults[0]!, false)
    assert.equal('passwordHash' in playerResults[0]!, false)
    const searchResults = await globalSearch(alice!.id, 'kaguya')
    assert.ok(searchResults.shinobis.some((shinobi) => /kaguya/i.test(shinobi.name ?? '')))
    assert.ok(Array.isArray(searchResults.players))
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})
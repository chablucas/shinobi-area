import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../src/config/prisma.js'
import { getCardKnowledgeById, listCardKnowledge } from '../src/game/cardKnowledge.js'
import { acceptGameInvite, createGameLobby, startGameLobby } from '../src/services/gameLobbyService.js'
import { drawCard, findGame, getGameForLobby, getGameForUser, placeCard } from '../src/services/realtimeGameService.js'

type StoredPlayer = { userId: number | null; pile: number[]; pendingCardId: number | null }
type StoredState = { players: StoredPlayer[] }

test('une partie persistante sécurise le tour, le tirage et le placement', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `realtime-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Realtime A ${suffix}` },
    { email: `realtime-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Realtime B ${suffix}` },
    { email: `realtime-outsider-${suffix}@example.test`, passwordHash: 'test', displayName: `Realtime outsider ${suffix}` },
  ], select: { id: true } })
  const [creator, opponent, outsider] = users
  try {
    const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
    const started = await startGameLobby(creator!.id, lobby!.id)
    const repeated = await startGameLobby(creator!.id, lobby!.id)
    assert.deepEqual(repeated?.id, started?.id)
    const game = await getGameForLobby(creator!.id, lobby!.id)
    assert.ok(game)
    await assert.rejects(() => getGameForUser(outsider!.id, game!.id), /accès/)
    const drawn = await drawCard(creator!.id, game!.id)
    assert.ok(drawn?.players[0]?.pendingCard)
    assert.equal(drawn?.players[1]?.pendingCard, null)
    await assert.rejects(() => drawCard(opponent!.id, game!.id), /tour/)
    const card = getCardKnowledgeById(drawn!.players[0]!.pendingCard!.id)!
    const category = card.traits.eligibleSlots.find((slot) => slot === 'chakra' || slot === 'ninjutsu' || slot === 'clan' || slot === 'kekkeiGenkai')!
    const placed = await placeCard(creator!.id, game!.id, category)
    assert.equal(placed?.currentPlayerNumber, 2)
    assert.ok(placed?.players[0]?.slots[category])
    await assert.rejects(() => placeCard(creator!.id, game!.id, category), /tour/)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('les deux pioches sont disjointes et couvrent le pool complet sans doublon', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `realtime-decks-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Decks A ${suffix}` },
    { email: `realtime-decks-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Decks B ${suffix}` },
  ], select: { id: true } })
  const [creator, opponent] = users
  try {
    const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
    await startGameLobby(creator!.id, lobby!.id)
    const game = await getGameForLobby(creator!.id, lobby!.id)
    const raw = await findGame(game!.id)
    const state = raw!.state as unknown as StoredState
    const [pileA, pileB] = state.players.map((player) => player.pile)
    const totalCards = listCardKnowledge().length
    assert.equal(pileA!.length + pileB!.length, totalCards)
    assert.equal(new Set([...pileA!, ...pileB!]).size, totalCards)
    assert.equal(pileA!.filter((id) => pileB!.includes(id)).length, 0)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('un double-clic PIOCHER ne sort qu’une seule carte', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `realtime-doubledraw-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Double A ${suffix}` },
    { email: `realtime-doubledraw-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Double B ${suffix}` },
  ], select: { id: true } })
  const [creator, opponent] = users
  try {
    const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
    await startGameLobby(creator!.id, lobby!.id)
    const game = await getGameForLobby(creator!.id, lobby!.id)
    const before = await findGame(game!.id)
    const pileBefore = (before!.state as unknown as StoredState).players.find((player) => player.userId === creator!.id)!.pile.length
    const results = await Promise.allSettled([drawCard(creator!.id, game!.id), drawCard(creator!.id, game!.id)])
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const after = await findGame(game!.id)
    const player = (after!.state as unknown as StoredState).players.find((candidate) => candidate.userId === creator!.id)!
    assert.equal(player.pile.length, pileBefore - 1)
    assert.ok(player.pendingCardId)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('un double-clic POSER ne place qu’une seule fois la carte', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `realtime-doubleplace-a-${suffix}@example.test`, passwordHash: 'test', displayName: `DoublePlace A ${suffix}` },
    { email: `realtime-doubleplace-b-${suffix}@example.test`, passwordHash: 'test', displayName: `DoublePlace B ${suffix}` },
  ], select: { id: true } })
  const [creator, opponent] = users
  try {
    const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
    await startGameLobby(creator!.id, lobby!.id)
    const game = await getGameForLobby(creator!.id, lobby!.id)
    const drawn = await drawCard(creator!.id, game!.id)
    const card = getCardKnowledgeById(drawn!.players[0]!.pendingCard!.id)!
    const category = card.traits.eligibleSlots.find((slot) => slot === 'chakra' || slot === 'ninjutsu' || slot === 'clan' || slot === 'kekkeiGenkai')!
    const results = await Promise.allSettled([placeCard(creator!.id, game!.id, category), placeCard(creator!.id, game!.id, category)])
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const after = await findGame(game!.id)
    const state = after!.state as unknown as StoredState & { players: Array<StoredPlayer & { slots: Record<string, number | null> }> }
    const player = state.players.find((candidate) => candidate.userId === creator!.id)!
    assert.equal(player.pendingCardId, null)
    assert.ok(player.slots[category])
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('le DTO public expose l’image et les catégories éligibles de la carte active', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `realtime-dto-a-${suffix}@example.test`, passwordHash: 'test', displayName: `DTO A ${suffix}` },
    { email: `realtime-dto-b-${suffix}@example.test`, passwordHash: 'test', displayName: `DTO B ${suffix}` },
  ], select: { id: true } })
  const [creator, opponent] = users
  try {
    const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
    await startGameLobby(creator!.id, lobby!.id)
    const game = await getGameForLobby(creator!.id, lobby!.id)
    const drawn = await drawCard(creator!.id, game!.id)
    const pending = drawn!.players.find((player) => player.userId === creator!.id)!.pendingCard!
    assert.ok(typeof pending.imageUrl === 'string' || pending.imageUrl === null)
    assert.ok(Array.isArray(pending.eligibleSlots))
    assert.ok(pending.eligibleSlots.length > 0)
    const category = pending.eligibleSlots[0]!
    const placed = await placeCard(creator!.id, game!.id, category)
    assert.ok(placed!.players.find((player) => player.userId === creator!.id)?.slots[category]?.imageUrl)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})
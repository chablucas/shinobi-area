import assert from 'node:assert/strict'
import test from 'node:test'
import { GameStatus, Prisma } from '@prisma/client'
import { prisma } from '../src/config/prisma.js'
import { getCardKnowledgeById, listCardKnowledge } from '../src/game/cardKnowledge.js'
import { simulateFight } from '../src/game/gameEngine.js'
import { acceptGameInvite, createGameLobby, startGameLobby } from '../src/services/gameLobbyService.js'
import { calculateGameResult, chooseGameResult, drawCard, findGame, GAME_CATEGORIES, getGameForLobby, getGameForUser, placeCard } from '../src/services/realtimeGameService.js'

type StoredPlayer = { userId: number | null; pile: number[]; pendingCardId: number | null }
type StoredState = { players: StoredPlayer[] }

async function setupDuoLobby(prefix: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `${prefix}-a-${suffix}@example.test`, passwordHash: 'test', displayName: `${prefix} A ${suffix}` },
    { email: `${prefix}-b-${suffix}@example.test`, passwordHash: 'test', displayName: `${prefix} B ${suffix}` },
    { email: `${prefix}-out-${suffix}@example.test`, passwordHash: 'test', displayName: `${prefix} Out ${suffix}` },
  ], select: { id: true } })
  const [creator, opponent, outsider] = users
  const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
  await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
  await startGameLobby(creator!.id, lobby!.id)
  const game = await getGameForLobby(creator!.id, lobby!.id)
  return { users, creator: creator!, opponent: opponent!, outsider: outsider!, gameId: game!.id }
}

// alterne les tours et remplit les catégories vides jusqu'au nombre de tours demandé
async function fillBoards(gameId: string, playerIds: [number, number], rounds: number) {
  let dto = await getGameForUser(playerIds[0], gameId)
  for (let i = 0; i < rounds; i++) {
    const actingId = dto!.currentPlayerNumber === 1 ? playerIds[0] : playerIds[1]
    const drawn = await drawCard(actingId, gameId)
    const me = drawn!.players.find((player) => player.userId === actingId)!
    const category = GAME_CATEGORIES.find((slot) => !me.slots[slot])!
    dto = await placeCard(actingId, gameId, category)
  }
  return dto!
}

function buildFromRawSlots(player: { slots: Record<string, number | null> }) {
  return { slots: Object.fromEntries(GAME_CATEGORIES.map((category) => [category, getCardKnowledgeById(player.slots[category]!)?.slug ?? ''])) }
}

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
    const category = GAME_CATEGORIES.find((slot) => !card.traits.eligibleSlots.includes(slot))!
    assert.ok(category)
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

test('14/15 puis 15/15 reste PLAYING tant que les deux plateaux ne sont pas complets', async () => {
  const { users, creator, opponent, gameId } = await setupDuoLobby('result-1415')
  try {
    const dto = await fillBoards(gameId, [creator.id, opponent.id], GAME_CATEGORIES.length * 2 - 1)
    assert.equal(dto.status, 'PLAYING')
    const filledCreator = Object.values(dto.players.find((player) => player.userId === creator.id)!.slots).filter(Boolean).length
    const filledOpponent = Object.values(dto.players.find((player) => player.userId === opponent.id)!.slots).filter(Boolean).length
    assert.equal(filledCreator, GAME_CATEGORIES.length)
    assert.equal(filledOpponent, GAME_CATEGORIES.length - 1)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('15/15 + 15/15 passe AWAITING_RESULT et verrouille pioche et placement', async () => {
  const { users, creator, opponent, gameId } = await setupDuoLobby('result-awaiting')
  try {
    const dto = await fillBoards(gameId, [creator.id, opponent.id], GAME_CATEGORIES.length * 2)
    assert.equal(dto.status, 'AWAITING_RESULT')
    assert.equal(dto.result, null)
    for (const player of dto.players) {
      assert.equal(Object.values(player.slots).filter(Boolean).length, GAME_CATEGORIES.length)
    }
    await assert.rejects(() => drawCard(creator.id, gameId), /terminée/)
    await assert.rejects(() => placeCard(creator.id, gameId, GAME_CATEGORIES[0]), /terminée/)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('AUTO refuse un outsider, utilise simulateFight pour les totaux/winnerNumber et empêche une double finalisation', async () => {
  const { users, creator, opponent, outsider, gameId } = await setupDuoLobby('result-auto')
  try {
    await fillBoards(gameId, [creator.id, opponent.id], GAME_CATEGORIES.length * 2)
    await assert.rejects(() => calculateGameResult(outsider.id, gameId), /accès/)

    const raw = await findGame(gameId)
    const rawState = raw!.state as unknown as { players: Array<{ userId: number | null; slots: Record<string, number | null> }> }
    const [rawPlayer1, rawPlayer2] = rawState.players
    const expected = simulateFight(buildFromRawSlots(rawPlayer1!), buildFromRawSlots(rawPlayer2!))
    const expectedWinnerNumber = expected.winner === 'player1' ? 1 : expected.winner === 'player2' ? 2 : null

    const auto = await calculateGameResult(creator.id, gameId)
    assert.equal(auto!.status, 'FINISHED')
    const result = auto!.result as { resultMode: string; winnerNumber: number | null; isDraw: boolean; player1Total: number; player2Total: number; player1: { finalStats: Record<string, number>; validationErrors: unknown[] }; player2: { validationErrors: unknown[] } }
    assert.equal(result.resultMode, 'AUTO')
    assert.equal(result.player1Total, expected.player1Total)
    assert.equal(result.player2Total, expected.player2Total)
    assert.equal(result.winnerNumber, expectedWinnerNumber)
    assert.equal(result.isDraw, expected.winner === 'draw')
    assert.equal(result.player1.validationErrors.length, 0)
    assert.equal(result.player2.validationErrors.length, 0)
    assert.equal(result.player1.finalStats.clan, 0)
    const manualTotal = Object.entries(result.player1.finalStats).filter(([key]) => key !== 'clan').reduce((sum, [, value]) => sum + Math.max(0, value), 0)
    assert.equal(manualTotal, result.player1Total)

    const afterManualAttempt = await chooseGameResult(creator.id, gameId, 2, false)
    const stillAuto = afterManualAttempt!.result as { resultMode: string; winnerNumber: number | null }
    assert.equal(stillAuto.resultMode, 'AUTO')
    assert.equal(stillAuto.winnerNumber, result.winnerNumber)

    const reloaded = await getGameForUser(creator.id, gameId)
    assert.equal(reloaded!.status, 'FINISHED')
    assert.equal((reloaded!.result as { winnerNumber: number | null }).winnerNumber, result.winnerNumber)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('AUTO peut être lancé par le second participant', async () => {
  const { users, creator, opponent, gameId } = await setupDuoLobby('result-auto-j2')
  try {
    await fillBoards(gameId, [creator.id, opponent.id], GAME_CATEGORIES.length * 2)
    const auto = await calculateGameResult(opponent.id, gameId)
    assert.equal(auto!.status, 'FINISHED')
    assert.equal((auto!.result as { resultMode: string }).resultMode, 'AUTO')
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('AUTO en égalité renvoie winnerNumber null et isDraw true', async () => {
  const { users, creator, opponent, gameId } = await setupDuoLobby('result-auto-draw')
  try {
    const cards = listCardKnowledge().slice(0, GAME_CATEGORIES.length)
    const mirroredSlots = Object.fromEntries(GAME_CATEGORIES.map((category, index) => [category, cards[index]!.id]))
    const state = {
      players: [
        { userId: creator.id, displayName: 'A', playerNumber: 1, pile: [], pendingCardId: null, slots: { ...mirroredSlots } },
        { userId: opponent.id, displayName: 'B', playerNumber: 2, pile: [], pendingCardId: null, slots: { ...mirroredSlots } },
      ],
      stateVersion: 1,
    }
    await prisma.game.update({ where: { id: gameId }, data: { state: state as unknown as Prisma.InputJsonValue, status: GameStatus.AWAITING_RESULT } })

    const auto = await calculateGameResult(creator.id, gameId)
    const result = auto!.result as { resultMode: string; winnerNumber: number | null; isDraw: boolean; player1Total: number; player2Total: number }
    assert.equal(result.resultMode, 'AUTO')
    assert.equal(result.isDraw, true)
    assert.equal(result.winnerNumber, null)
    assert.equal(result.player1Total, result.player2Total)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('MANUAL refuse le non-hôte et l’outsider, puis le host peut désigner le joueur 1', async () => {
  const { users, creator, opponent, outsider, gameId } = await setupDuoLobby('result-manual-j1')
  try {
    await fillBoards(gameId, [creator.id, opponent.id], GAME_CATEGORIES.length * 2)
    await assert.rejects(() => chooseGameResult(opponent.id, gameId, 1, false), /hôte/)
    await assert.rejects(() => chooseGameResult(outsider.id, gameId, 1, false), /accès/)

    const manual = await chooseGameResult(creator.id, gameId, 1, false)
    assert.equal(manual!.status, 'FINISHED')
    const result = manual!.result as { resultMode: string; winnerNumber: number | null; isDraw: boolean }
    assert.equal(result.resultMode, 'MANUAL')
    assert.equal(result.winnerNumber, 1)
    assert.equal(result.isDraw, false)

    const reloaded = await getGameForUser(opponent.id, gameId)
    assert.equal(reloaded!.status, 'FINISHED')
    assert.equal((reloaded!.result as { winnerNumber: number | null }).winnerNumber, 1)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('MANUAL permet au host de désigner le joueur 2', async () => {
  const { users, creator, opponent, gameId } = await setupDuoLobby('result-manual-j2')
  try {
    await fillBoards(gameId, [creator.id, opponent.id], GAME_CATEGORIES.length * 2)
    const manual = await chooseGameResult(creator.id, gameId, 2, false)
    assert.equal(manual!.status, 'FINISHED')
    const result = manual!.result as { resultMode: string; winnerNumber: number | null; isDraw: boolean }
    assert.equal(result.resultMode, 'MANUAL')
    assert.equal(result.winnerNumber, 2)
    assert.equal(result.isDraw, false)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('MANUAL permet au host de déclarer une égalité', async () => {
  const { users, creator, opponent, gameId } = await setupDuoLobby('result-manual-draw')
  try {
    await fillBoards(gameId, [creator.id, opponent.id], GAME_CATEGORIES.length * 2)
    const manual = await chooseGameResult(creator.id, gameId, null, true)
    assert.equal(manual!.status, 'FINISHED')
    const result = manual!.result as { resultMode: string; winnerNumber: number | null; isDraw: boolean }
    assert.equal(result.resultMode, 'MANUAL')
    assert.equal(result.winnerNumber, null)
    assert.equal(result.isDraw, true)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('deux appels AUTO concurrents ne produisent qu’un seul résultat', async () => {
  const { users, creator, opponent, gameId } = await setupDuoLobby('result-auto-concurrent')
  try {
    await fillBoards(gameId, [creator.id, opponent.id], GAME_CATEGORIES.length * 2)
    const outcomes = await Promise.allSettled([calculateGameResult(creator.id, gameId), calculateGameResult(opponent.id, gameId)])
    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled') as Array<PromiseFulfilledResult<Awaited<ReturnType<typeof calculateGameResult>>>>
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected') as PromiseRejectedResult[]
    assert.ok(fulfilled.length >= 1)
    for (const outcome of rejected) assert.equal((outcome.reason as { statusCode?: number }).statusCode, 409)
    const winnerNumbers = new Set(fulfilled.map((outcome) => (outcome.value!.result as { winnerNumber: number | null }).winnerNumber))
    assert.equal(winnerNumbers.size, 1)
    const reloaded = await getGameForUser(creator.id, gameId)
    assert.equal(reloaded!.status, 'FINISHED')
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})
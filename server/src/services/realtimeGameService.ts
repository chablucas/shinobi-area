import { GameMode, GameStatus, Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { getCardKnowledgeById, listCardKnowledge } from '../game/cardKnowledge.js'
import { simulateFight } from '../game/gameEngine.js'

export const GAME_CATEGORIES = ['chakra', 'invocation', 'iq', 'ninjutsu', 'genjutsu', 'taijutsu', 'avatar', 'body', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'clan', 'vitesse', 'kekkei-genkai', 'kekkei-mora'] as const
type Category = typeof GAME_CATEGORIES[number]
type StoredPlayer = { userId: number | null; displayName: string; playerNumber: number; pile: number[]; pendingCardId: number | null; slots: Record<Category, number | null> }
type AutoGameResult = ReturnType<typeof simulateFight> & { resultMode: 'AUTO'; winnerNumber: 1 | 2 | null; isDraw: boolean }
type ManualGameResult = { resultMode: 'MANUAL'; winnerNumber: 1 | 2 | null; isDraw: boolean }
type StoredState = { players: StoredPlayer[]; result?: AutoGameResult | ManualGameResult | ReturnType<typeof simulateFight>; stateVersion?: number }

function invalid(message: string, statusCode = 400) { return Object.assign(new Error(message), { statusCode }) }
function emptySlots() { return Object.fromEntries(GAME_CATEGORIES.map((category) => [category, null])) as Record<Category, number | null> }
function normalizeCategory(category: unknown): Category | null { return typeof category === 'string' && (GAME_CATEGORIES as readonly string[]).includes(category) ? category as Category : null }
function stateOf(value: Prisma.JsonValue): StoredState { return value as unknown as StoredState }
function playerFor(state: StoredState, userId: number) { return state.players.find((player) => player.userId === userId) }
function playersAreComplete(state: StoredState) { return state.players.length === 2 && state.players.every((player) => GAME_CATEGORIES.every((category) => player.slots[category] !== null)) }
function isTransientDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return ['P2034', 'P2024', 'P2028', 'P1001'].includes(error.code)
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return /transaction api error|unable to start a transaction|timeout|deadlock|database.*unavailable|connection.*reset|connection.*closed/i.test(message)
  }
  return false
}
async function retryTransientMutation<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await operation() } catch (error) { lastError = error; if (!isTransientDbError(error) || attempt >= 3) throw error }
  }
  throw lastError
}
function buildFor(player: StoredPlayer) {
  return { slots: Object.fromEntries(Object.entries(player.slots).map(([slot, id]) => [slot, getCardKnowledgeById(id!)?.slug ?? ''])) }
}
const lobbyInclude = { creator: { select: { id: true, displayName: true } }, invites: { include: { invitee: { select: { id: true, displayName: true } } } } }
function gameInclude() { return { lobby: { include: lobbyInclude } } }

// Les IDs stockés dans l'état de partie (pile, pendingCardId, slots) sont les IDs du catalogue canonique
// (shinobi-cards.json), jamais les IDs autoincrement de la table Prisma Card. Toute jointure avec Prisma
// (imageUrl notamment) doit donc se faire par slug canonique, pas par id.
async function cardView(id: number, imageBySlug: Map<string, string | null>) {
  const card = getCardKnowledgeById(id)
  if (!card) return null
  return {
    id: card.id,
    slug: card.slug,
    name: card.name,
    clans: card.clans,
    stats: card.stats,
    imageUrl: imageBySlug.get(card.slug) ?? null,
    eligibleSlots: card.traits.eligibleSlots,
  }
}

export async function publicGameState(game: Awaited<ReturnType<typeof findGame>>, userId: number) {
  if (!game) return null
  const state = stateOf(game.state)
  const stateVersion = Number.isFinite(state.stateVersion) ? Number(state.stateVersion) : (game.turnNumber ?? 0)
  const cardSlugs = new Set<string>()
  for (const player of state.players) {
    if (player.pendingCardId) {
      const slug = getCardKnowledgeById(player.pendingCardId)?.slug
      if (slug) cardSlugs.add(slug)
    }
    for (const cardId of Object.values(player.slots)) {
      if (!cardId) continue
      const slug = getCardKnowledgeById(cardId)?.slug
      if (slug) cardSlugs.add(slug)
    }
  }
  const imageBySlug = new Map<string, string | null>(
    (await prisma.card.findMany({ where: { slug: { in: [...cardSlugs] } }, select: { slug: true, imageUrl: true } })).map((card) => [card.slug, card.imageUrl]),
  )
  const players = [] as Array<{ userId: number | null; displayName: string; playerNumber: number; cardsRemaining: number; pendingCard: Awaited<ReturnType<typeof cardView>> | null; slots: Record<string, Awaited<ReturnType<typeof cardView>> | null> }>
  for (const player of state.players) {
    const slots: Record<string, Awaited<ReturnType<typeof cardView>> | null> = {}
    for (const [category, cardId] of Object.entries(player.slots)) {
      slots[category] = cardId ? await cardView(cardId, imageBySlug) : null
    }
    players.push({
      userId: player.userId,
      displayName: player.displayName,
      playerNumber: player.playerNumber,
      cardsRemaining: player.pile.length,
      pendingCard: player.userId === userId && player.pendingCardId ? await cardView(player.pendingCardId, imageBySlug) : null,
      slots,
    })
  }
  return {
    id: game.id,
    lobbyId: game.lobbyId,
    mode: game.mode === GameMode.ONE_V_ONE ? '1v1' : '1v1v1',
    status: game.status,
    currentPlayerNumber: game.currentPlayerNumber,
    turnNumber: game.turnNumber,
    stateVersion,
    players,
    result: state.result ?? null,
  }
}

async function findGame(id: string) { return prisma.game.findUnique({ where: { id }, include: gameInclude() }) }
async function findGameForLobby(lobbyId: string) { return prisma.game.findUnique({ where: { lobbyId }, include: gameInclude() }) }

export async function createOrGetGame(lobbyId: string) {
  const existing = await findGameForLobby(lobbyId)
  if (existing) return existing
  const lobby = await prisma.gameLobby.findUnique({ where: { id: lobbyId }, include: lobbyInclude })
  if (!lobby) throw invalid('Salon introuvable.', 404)
  if (lobby.status !== 'PLAYING') throw invalid('Le salon n’est pas en cours.', 409)
  const users = [lobby.creator, ...lobby.invites.filter((invite) => invite.status === 'ACCEPTED').map((invite) => invite.invitee)]
  if (users.length < 2) throw invalid('Les joueurs du salon ne sont pas prêts.', 409)
  // Le deck stocke des IDs canoniques : l'intersection avec Prisma se fait par slug canonique,
  // jamais en supposant que l'ID canonique (JSON) égale l'ID Prisma (autoincrement).
  const canonicalCards = listCardKnowledge()
  const present = await prisma.card.findMany({ where: { slug: { in: canonicalCards.map((card) => card.slug) } }, select: { slug: true } })
  const presentSlugs = new Set(present.map((card) => card.slug))
  const available = canonicalCards.filter((card) => presentSlugs.has(card.slug)).map((card) => card.id).sort(() => Math.random() - 0.5)
  const players: StoredPlayer[] = users.map((user, index) => ({ userId: user.id, displayName: user.displayName, playerNumber: index + 1, pile: available.filter((_, cardIndex) => cardIndex % users.length === index), pendingCardId: null, slots: emptySlots() }))
  const state: StoredState = { players }
  try {
    return await prisma.game.create({ data: { lobbyId, mode: lobby.mode, state: state as unknown as Prisma.InputJsonValue }, include: gameInclude() })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return (await findGameForLobby(lobbyId))!
    throw error
  }
}

export async function getGameForUser(userId: number, gameId: string) {
  const game = await findGame(gameId)
  if (!game) throw invalid('Partie introuvable.', 404)
  if (!playerFor(stateOf(game.state), userId)) throw invalid('Vous n’avez pas accès à cette partie.', 403)
  return await publicGameState(game, userId)
}

export async function getGameForLobby(userId: number, lobbyId: string) {
  const game = await findGameForLobby(lobbyId)
  if (!game) throw invalid('Partie introuvable.', 404)
  if (!playerFor(stateOf(game.state), userId)) throw invalid('Vous n’avez pas accès à cette partie.', 403)
  return await publicGameState(game, userId)
}

async function mutate(userId: number, gameId: string, mutation: (game: NonNullable<Awaited<ReturnType<typeof findGame>>>, state: StoredState, player: StoredPlayer) => boolean | void) {
  try {
    const game = await retryTransientMutation(async () => prisma.$transaction(async (transaction) => {
      const current = await transaction.game.findUnique({ where: { id: gameId }, include: gameInclude() })
      if (!current) throw invalid('Partie introuvable.', 404)
      const state = stateOf(current.state)
      const player = playerFor(state, userId)
      if (!player) throw invalid('Vous n’avez pas accès à cette partie.', 403)
      const advanceTurn = mutation(current, state, player) !== false
      const nextStateVersion = (Number(state.stateVersion ?? current.turnNumber) || 0) + 1
      state.stateVersion = nextStateVersion
      const awaitingResult = current.status === GameStatus.PLAYING && playersAreComplete(state)
      return transaction.game.update({ where: { id: gameId }, data: { state: state as unknown as Prisma.InputJsonValue, status: awaitingResult ? GameStatus.AWAITING_RESULT : current.status, currentPlayerNumber: advanceTurn && !awaitingResult ? state.players[(player.playerNumber % state.players.length)]!.playerNumber : current.currentPlayerNumber, turnNumber: advanceTurn && !awaitingResult ? current.turnNumber + 1 : current.turnNumber }, include: gameInclude() })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }))
    return await publicGameState(game, userId)
  } catch (error) {
    if (isTransientDbError(error)) throw invalid('Action temporairement indisponible. Réessaie.', 409)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw invalid('Action concurrent refusée, réessaie.', 409)
    throw error
  }
}

export function drawCard(userId: number, gameId: string) {
  return mutate(userId, gameId, (game, state, player) => {
    if (game.status !== GameStatus.PLAYING) throw invalid('La partie est terminée.', 409)
    if (game.currentPlayerNumber !== player.playerNumber) throw invalid('Ce n’est pas ton tour.', 409)
    if (player.pendingCardId) throw invalid('Une carte doit d’abord être placée.', 409)
    const cardId = player.pile.shift()
    if (!cardId) throw invalid('La pioche est vide.', 409)
    player.pendingCardId = cardId
    return false
  })
}

export function placeCard(userId: number, gameId: string, rawCategory: unknown) {
  return mutate(userId, gameId, (game, state, player) => {
    if (game.status !== GameStatus.PLAYING) throw invalid('La partie est terminée.', 409)
    if (game.currentPlayerNumber !== player.playerNumber) throw invalid('Ce n’est pas ton tour.', 409)
    const category = normalizeCategory(rawCategory)
    if (!category) throw invalid('Catégorie invalide.')
    if (!player.pendingCardId) throw invalid('Aucune carte en attente.', 409)
    if (player.slots[category]) throw invalid('Cette catégorie est déjà remplie.', 409)
    player.slots[category] = player.pendingCardId
    player.pendingCardId = null
  })
}

async function finalizeGame(userId: number, gameId: string, mode: 'AUTO' | 'MANUAL', winnerNumber?: 1 | 2 | null, isDraw?: boolean) {
  try {
    const game = await retryTransientMutation(async () => prisma.$transaction(async (transaction) => {
      const current = await transaction.game.findUnique({ where: { id: gameId }, include: gameInclude() })
      if (!current) throw invalid('Partie introuvable.', 404)
      const state = stateOf(current.state)
      if (!playerFor(state, userId)) throw invalid('Vous n’avez pas accès à cette partie.', 403)
      if (current.status === GameStatus.FINISHED) return current
      if (current.status !== GameStatus.AWAITING_RESULT || !playersAreComplete(state)) throw invalid('La partie n’attend pas de résultat.', 409)
      if (mode === 'MANUAL' && current.lobby.creatorId !== userId) throw invalid('Seul l’hôte peut choisir le vainqueur.', 403)
      const result: AutoGameResult | ManualGameResult = mode === 'AUTO'
        ? (() => {
            const fight = simulateFight(buildFor(state.players[0]!), buildFor(state.players[1]!))
            const resolvedWinner = fight.winner === 'player1' ? 1 : fight.winner === 'player2' ? 2 : null
            return { ...fight, resultMode: 'AUTO', winnerNumber: resolvedWinner, isDraw: resolvedWinner === null }
          })()
        : { resultMode: 'MANUAL', winnerNumber: isDraw ? null : winnerNumber ?? null, isDraw: Boolean(isDraw) }
      if (mode === 'MANUAL' && !result.isDraw && result.winnerNumber === null) throw invalid('Choisis un vainqueur ou une égalité.')
      state.result = result
      state.stateVersion = (Number(state.stateVersion ?? current.turnNumber) || 0) + 1
      return transaction.game.update({ where: { id: gameId }, data: { state: state as unknown as Prisma.InputJsonValue, status: GameStatus.FINISHED, winnerNumber: result.winnerNumber, finishedAt: new Date() }, include: gameInclude() })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }))
    return await publicGameState(game, userId)
  } catch (error) {
    if (isTransientDbError(error)) throw invalid('Impossible de démarrer la partie. Réessaie.', 409)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw invalid('Action concurrent refusée, réessaie.', 409)
    throw error
  }
}

export function calculateGameResult(userId: number, gameId: string) { return finalizeGame(userId, gameId, 'AUTO') }
export function chooseGameResult(userId: number, gameId: string, winnerNumber: unknown, isDraw: unknown) {
  const validWinner = winnerNumber === 1 || winnerNumber === 2 ? winnerNumber : null
  if (isDraw !== true && validWinner === null) throw invalid('Choisis le joueur 1, le joueur 2 ou une égalité.')
  return finalizeGame(userId, gameId, 'MANUAL', validWinner, isDraw === true)
}

export function playerNumberFor(state: Prisma.JsonValue, userId: number) { return playerFor(stateOf(state), userId)?.playerNumber ?? null }
export { findGame }

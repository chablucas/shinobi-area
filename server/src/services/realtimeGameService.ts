import { GameMode, GameStatus, Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { getCardKnowledgeById, listCardKnowledge } from '../game/cardKnowledge.js'
import { simulateFight } from '../game/gameEngine.js'

export const GAME_CATEGORIES = ['chakra', 'invocation', 'iq', 'ninjutsu', 'genjutsu', 'taijutsu', 'avatar', 'body', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'clan', 'vitesse', 'kekkei-genkai', 'kekkei-mora'] as const
type Category = typeof GAME_CATEGORIES[number]
type StoredPlayer = { userId: number | null; displayName: string; playerNumber: number; pile: number[]; pendingCardId: number | null; slots: Record<Category, number | null> }
type StoredState = { players: StoredPlayer[]; result?: ReturnType<typeof simulateFight> }

function invalid(message: string, statusCode = 400) { return Object.assign(new Error(message), { statusCode }) }
function emptySlots() { return Object.fromEntries(GAME_CATEGORIES.map((category) => [category, null])) as Record<Category, number | null> }
function normalizeCategory(category: unknown): Category | null { return typeof category === 'string' && (GAME_CATEGORIES as readonly string[]).includes(category) ? category as Category : null }
function slotKey(value: string) { return value.toLowerCase().replaceAll('-', '').replaceAll('ō', 'o').replaceAll('ū', 'u') }
function stateOf(value: Prisma.JsonValue): StoredState { return value as unknown as StoredState }
function playerFor(state: StoredState, userId: number) { return state.players.find((player) => player.userId === userId) }
const lobbyInclude = { creator: { select: { id: true, displayName: true } }, invites: { include: { invitee: { select: { id: true, displayName: true } } } } }
function gameInclude() { return { lobby: { include: lobbyInclude } } }

function cardView(id: number) {
  const card = getCardKnowledgeById(id)
  if (!card) return null
  return { id: card.id, slug: card.slug, name: card.name, clans: card.clans, stats: card.stats }
}

export function publicGameState(game: Awaited<ReturnType<typeof findGame>>, userId: number) {
  if (!game) return null
  const state = stateOf(game.state)
  return {
    id: game.id,
    lobbyId: game.lobbyId,
    mode: game.mode === GameMode.ONE_V_ONE ? '1v1' : '1v1v1',
    status: game.status,
    currentPlayerNumber: game.currentPlayerNumber,
    turnNumber: game.turnNumber,
    players: state.players.map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      playerNumber: player.playerNumber,
      cardsRemaining: player.pile.length,
      pendingCard: player.userId === userId && player.pendingCardId ? cardView(player.pendingCardId) : null,
      slots: Object.fromEntries(Object.entries(player.slots).map(([category, cardId]) => [category, cardId ? cardView(cardId) : null])),
    })),
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
  const knowledge = listCardKnowledge().map((card) => card.id)
  const cards = await prisma.card.findMany({ where: { id: { in: knowledge } }, select: { id: true } })
  const available = cards.map((card) => card.id).sort(() => Math.random() - 0.5)
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
  return publicGameState(game, userId)
}

export async function getGameForLobby(userId: number, lobbyId: string) {
  const game = await findGameForLobby(lobbyId)
  if (!game) throw invalid('Partie introuvable.', 404)
  if (!playerFor(stateOf(game.state), userId)) throw invalid('Vous n’avez pas accès à cette partie.', 403)
  return publicGameState(game, userId)
}

async function mutate(userId: number, gameId: string, mutation: (game: NonNullable<Awaited<ReturnType<typeof findGame>>>, state: StoredState, player: StoredPlayer) => boolean | void) {
  try {
    const game = await prisma.$transaction(async (transaction) => {
      const current = await transaction.game.findUnique({ where: { id: gameId }, include: gameInclude() })
      if (!current) throw invalid('Partie introuvable.', 404)
      const state = stateOf(current.state)
      const player = playerFor(state, userId)
      if (!player) throw invalid('Vous n’avez pas accès à cette partie.', 403)
      const advanceTurn = mutation(current, state, player) !== false
      return transaction.game.update({ where: { id: gameId }, data: { state: state as unknown as Prisma.InputJsonValue, status: state.result ? GameStatus.FINISHED : current.status, winnerNumber: state.result?.winner === 'player1' ? 1 : state.result?.winner === 'player2' ? 2 : null, finishedAt: state.result ? new Date() : undefined, currentPlayerNumber: advanceTurn && !state.result ? state.players[(player.playerNumber % state.players.length)]!.playerNumber : current.currentPlayerNumber, turnNumber: advanceTurn && !state.result ? current.turnNumber + 1 : current.turnNumber }, include: gameInclude() })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return publicGameState(game, userId)
  } catch (error) {
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
    const card = getCardKnowledgeById(player.pendingCardId)
    if (!card || !card.traits.eligibleSlots.some((slot) => slotKey(slot) === slotKey(category))) throw invalid('Cette carte ne peut pas être placée dans cette catégorie.', 409)
    player.slots[category] = player.pendingCardId
    player.pendingCardId = null
    if (state.players.every((candidate) => GAME_CATEGORIES.every((slot) => candidate.slots[slot] !== null))) {
      state.result = simulateFight(...state.players.slice(0, 2).map((candidate) => ({ slots: Object.fromEntries(Object.entries(candidate.slots).map(([slot, id]) => [slot, getCardKnowledgeById(id!)!.slug])) })) as [{ slots: Record<string, string> }, { slots: Record<string, string> }])
    }
  })
}

export function playerNumberFor(state: Prisma.JsonValue, userId: number) { return playerFor(stateOf(state), userId)?.playerNumber ?? null }
export { findGame }

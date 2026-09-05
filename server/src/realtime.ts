import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { requireJwtSecret } from './config/env.js'
import { prisma } from './config/prisma.js'
import { drawCard, findGame, getGameForUser, placeCard, publicGameState } from './services/realtimeGameService.js'
import { getCardKnowledgeById } from './game/cardKnowledge.js'
import { teamAuctionRules } from './game/teamAuctionRules.js'
import { calculateTeamAuctionScore } from './game/teamMode.js'
import { getTeamAuctionPowerScore } from './game/teamAuctionPower.js'
import { allInTeamBid, chooseAiPlacement, createTeamAuctionGame, drawNextTeamCard, evaluateTeamAuctionAi, getTeamAuctionGame, passTeamBid, placeTeamCard, startTeamAuctionGame, submitTeamBid, type TeamAuctionGame, type TeamAuctionMode } from './services/teamAuctionGameService.js'

type SocketData = { userId?: number; gameId?: string }
let broadcastGameState: ((gameId: string) => Promise<void>) | null = null
const teamAuctionHosts = new Map<string, number>()

function teamAuctionExpectedPlayers(mode: TeamAuctionMode) { return mode === '1v1v1-real' ? 3 : 2 }
function isTeamAuctionParticipant(game: TeamAuctionGame, userId: number) { return game.players.some((player) => player.id === userId) }
/** Le nombre de joueurs vient des participants uniques, jamais du nombre de sockets. */
function teamAuctionPlayerCount(game: TeamAuctionGame) { return new Set(game.players.map((player) => String(player.id))).size }
function teamAuctionCanStart(game: TeamAuctionGame) { return game.phase === 'LOBBY' && teamAuctionPlayerCount(game) === teamAuctionExpectedPlayers(game.mode) }
async function teamAuctionDisplayName(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } })
  return user?.displayName.trim() || 'Joueur'
}

/** Salon adossé à un GameLobby Prisma : seuls le créateur et les invités peuvent entrer. */
async function isTeamAuctionLobbyMember(gameId: string, userId: number) {
  const lobby = await prisma.gameLobby.findUnique({ where: { id: gameId }, select: { creatorId: true, invites: { select: { inviteeId: true } } } })
  if (!lobby) return true
  return lobby.creatorId === userId || lobby.invites.some((invite) => invite.inviteeId === userId)
}

async function getOrInitTeamAuctionGame(gameId: string, userId: number) {
  let game = getTeamAuctionGame(gameId)
  if (game) return game

  const lobby = await prisma.gameLobby.findUnique({
    where: { id: gameId },
    include: {
      creator: { select: { id: true, displayName: true } },
      invites: { include: { invitee: { select: { id: true, displayName: true } } } },
    },
  })
  if (!lobby) return null

  const isParticipant = lobby.creatorId === userId || lobby.invites.some((invite) => invite.inviteeId === userId)
  if (!isParticipant) return null

  const mode: TeamAuctionMode = lobby.mode === 'ONE_V_ONE' ? '1v1-real' : '1v1v1-real'
  const players: Array<{ id: number | string; displayName: string; isAi: boolean }> = [
    { id: lobby.creator.id, displayName: lobby.creator.displayName, isAi: false },
    ...lobby.invites
      .filter((invite) => invite.status === 'ACCEPTED' || invite.inviteeId === userId)
      .map((invite) => ({ id: invite.invitee.id, displayName: invite.invitee.displayName, isAi: false })),
  ]
  if (lobby.includesAi && players.length < teamAuctionExpectedPlayers(mode)) {
    players.push({ id: `ai-${lobby.id}`, displayName: 'IA', isAi: true })
  }

  game = createTeamAuctionGame({
    gameId: lobby.id,
    mode,
    players,
    teamSizes: [3, 3],
    initialBudget: 500,
  })
  teamAuctionHosts.set(lobby.id, lobby.creatorId)
  return game
}

async function teamAuctionPublicState(game: TeamAuctionGame) {
  const slugs = new Set<string>()
  if (game.currentCardId !== null) {
    const currentSlug = getCardKnowledgeById(game.currentCardId)?.slug
    if (currentSlug) slugs.add(currentSlug)
  }
  for (const player of game.players) {
    for (const team of player.teams) {
      for (const cardId of team) {
        const slug = getCardKnowledgeById(cardId)?.slug
        if (slug) slugs.add(slug)
      }
    }
  }
  const images = slugs.size
    ? await prisma.card.findMany({ where: { slug: { in: [...slugs] } }, select: { slug: true, imageUrl: true } })
    : []
  const imageBySlug = new Map(images.map((card) => [card.slug, card.imageUrl]))

  const cardView = (cardId: number) => {
    const card = getCardKnowledgeById(cardId)
    return card ? { id: card.id, name: card.name, slug: card.slug, imageUrl: imageBySlug.get(card.slug) ?? null, rarity: card.rarity, rarityScore: card.rarityScore, score: getTeamAuctionPowerScore(card.slug), stats: card.stats } : null
  }

  return {
    gameId: game.gameId,
    hostId: teamAuctionHosts.get(game.gameId) ?? null,
    mode: game.mode,
    phase: game.phase,
    expectedPlayers: teamAuctionExpectedPlayers(game.mode),
    playerCount: teamAuctionPlayerCount(game),
    canStart: teamAuctionCanStart(game),
    teamSizes: game.teamSizes,
    initialBudget: game.initialBudget,
    roundNumber: game.roundNumber,
    currentCard: game.currentCardId === null ? null : cardView(game.currentCardId),
    currentBid: game.currentBid,
    currentBidderId: game.currentBidderId,
    currentTurnId: game.currentTurnId,
    winnerId: game.winnerId,
    rules: { minBid: teamAuctionRules.minBid, bidUnit: teamAuctionRules.bidUnit, allowAllIn: teamAuctionRules.allowAllIn },
    finalResults: game.finalResults,
    players: game.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      isAi: player.isAi,
      budget: player.budget,
      passedCurrentRound: player.passedCurrentRound,
      activeCurrentRound: player.activeCurrentRound,
      teams: player.teams.map((team, index) => ({
        teamNumber: index + 1,
        capacity: game.teamSizes[index] ?? 0,
        average: calculateTeamAuctionScore(team.map((cardId) => ({ slug: getCardKnowledgeById(cardId)?.slug ?? '' }))),
        cards: team.map((cardId) => cardView(cardId) ?? { id: cardId, name: String(cardId), slug: '', imageUrl: null, rarity: '', rarityScore: 0, score: 0, stats: {} }),
      })),
    })),
  }
}

function teamAuctionError(error: unknown) { return error instanceof Error ? error.message : 'Action Team Auction refusée.' }

function advanceTeamAuction(gameId: string) {
  const game = getTeamAuctionGame(gameId)
  if (!game) throw new Error('Partie introuvable.')
  let safety = 0
  while (game.phase !== 'RESULTS' && game.phase !== 'FINISHED' && safety++ < 500) {
    if (game.phase === 'DRAW') { drawNextTeamCard(gameId); continue }
    if (game.phase === 'PLACEMENT' && game.winnerId !== null) {
      const winner = game.players.find((player) => player.id === game.winnerId)
      if (winner?.isAi && game.currentCardId !== null) {
        const teamIndex = chooseAiPlacement(gameId, winner.id, game.currentCardId)
        if (teamIndex === null) throw new Error('L’IA ne trouve aucune équipe disponible.')
        placeTeamCard(gameId, winner.id, teamIndex)
        continue
      }
    }
    if (game.phase === 'BIDDING' && game.currentTurnId !== null) {
      const player = game.players.find((candidate) => candidate.id === game.currentTurnId)
      if (player?.isAi) {
        const decision = evaluateTeamAuctionAi(gameId, player.id)
        if (!decision || decision.action === 'pass') passTeamBid(gameId, player.id)
        else if (decision.action === 'allin') allInTeamBid(gameId, player.id)
        else submitTeamBid(gameId, player.id, decision.amount)
        continue
      }
    }
    break
  }
  if (safety >= 500) throw new Error('La progression Team Auction a dépassé sa limite.')
  return game
}

export async function emitGameState(gameId: string) { await broadcastGameState?.(gameId) }

export function attachRealtime(io: Server) {
  io.use((socket, next) => {
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : ''
    try {
      const payload = jwt.verify(token, requireJwtSecret())
      if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Token invalide')
      const userId = Number(payload.sub)
      if (!Number.isInteger(userId)) throw new Error('Token invalide')
      ;(socket.data as SocketData).userId = userId
      next()
    } catch { next(new Error('Authentification socket invalide.')) }
  })

  async function emitState(gameId: string) {
    const sockets = await io.in(`game:${gameId}`).fetchSockets()
    const game = await findGame(gameId)
    if (!game) return
    for (const socket of sockets) {
      const userId = (socket.data as SocketData).userId
      if (userId) socket.emit('game:state', await publicGameState(game, userId))
    }
  }
  broadcastGameState = emitState

  async function emitTeamAuctionState(gameId: string) {
    const game = getTeamAuctionGame(gameId)
    if (!game) return
    io.in(`team-auction:${gameId}`).emit('team-auction:state', await teamAuctionPublicState(game))
  }

  /** Enregistre le participant (une seule fois par userId), rattache le socket au salon. */
  async function joinTeamAuctionLobby(socket: { join: (room: string) => Promise<void> | void; data: SocketData }, gameId: string, userId: number) {
    const game = await getOrInitTeamAuctionGame(gameId, userId)
    if (!game) throw new Error('Salon Team Auction introuvable.')
    const alreadyParticipant = isTeamAuctionParticipant(game, userId)
    if (!alreadyParticipant) {
      if (game.phase !== 'LOBBY') throw new Error('La partie a déjà démarré.')
      if (!(await isTeamAuctionLobbyMember(gameId, userId))) throw new Error('Tu ne participes pas à ce salon.')
      if (teamAuctionPlayerCount(game) >= teamAuctionExpectedPlayers(game.mode)) throw new Error('Le salon est plein.')
      game.players.push({ id: userId, displayName: await teamAuctionDisplayName(userId), isAi: false, budget: game.initialBudget, teams: game.teamSizes.map(() => []), passedCurrentRound: false, activeCurrentRound: true })
    }
    await socket.join(`team-auction:${gameId}`)
    socket.data.gameId = gameId
    return { game, added: !alreadyParticipant }
  }

  io.on('connection', (socket) => {
    const userId = (socket.data as SocketData).userId
    if (!userId) return
    socket.on('team-auction:create', async (payload: { mode?: unknown; teamSizes?: unknown; initialBudget?: unknown }, acknowledge?: (response: unknown) => void) => {
      try {
        const mode = payload?.mode
        if (mode !== '1v1-ai' && mode !== '1v1-real' && mode !== '1v1v1-real') throw new Error('Mode Team Auction invalide.')
        const teamSizes = Array.isArray(payload.teamSizes) ? payload.teamSizes.filter((size): size is number => typeof size === 'number') : []
        const initialBudget = typeof payload.initialBudget === 'number' ? payload.initialBudget : 0
        const players: Array<{ id: number | string; displayName: string; isAi: boolean }> = [{ id: userId, displayName: await teamAuctionDisplayName(userId), isAi: false }]
        if (mode === '1v1-ai') players.push({ id: `ai-${userId}`, displayName: 'IA', isAi: true })
        const game = createTeamAuctionGame({ mode, players, teamSizes, initialBudget })
        teamAuctionHosts.set(game.gameId, userId)
        await socket.join(`team-auction:${game.gameId}`)
        socket.data.gameId = game.gameId
        if (mode === '1v1-ai') { startTeamAuctionGame(game.gameId); advanceTeamAuction(game.gameId) }
        await emitTeamAuctionState(game.gameId)
        acknowledge?.({ ok: true, gameId: game.gameId })
      } catch (error) { acknowledge?.({ ok: false, message: teamAuctionError(error) }); socket.emit('team-auction:error', { message: teamAuctionError(error) }) }
    })
    socket.on('team-auction:join', async (gameId: unknown, acknowledge?: (response: unknown) => void) => {
      try {
        if (typeof gameId !== 'string' || !gameId) throw new Error('Code de salon invalide.')
        await joinTeamAuctionLobby(socket, gameId, userId)
        await emitTeamAuctionState(gameId)
        acknowledge?.({ ok: true, gameId })
      } catch (error) { acknowledge?.({ ok: false, message: teamAuctionError(error) }); socket.emit('team-auction:error', { message: teamAuctionError(error) }) }
    })
    socket.on('team-auction:start', async (gameId: unknown) => {
      try {
        if (typeof gameId !== 'string' || teamAuctionHosts.get(gameId) !== userId) throw new Error('Seul l’hôte peut lancer cette partie.')
        const game = getTeamAuctionGame(gameId)
        if (!game) throw new Error('Salon Team Auction introuvable.')
        if (game.phase !== 'LOBBY') throw new Error('La partie a déjà démarré.')
        if (!teamAuctionCanStart(game)) throw new Error('Le nombre de joueurs requis n’est pas atteint.')
        startTeamAuctionGame(gameId); advanceTeamAuction(gameId); await emitTeamAuctionState(gameId)
      } catch (error) { socket.emit('team-auction:error', { message: teamAuctionError(error) }) }
    })
    socket.on('team-auction:request-state', async (gameId: unknown) => {
      try {
        if (typeof gameId !== 'string' || !gameId) throw new Error('Code de salon invalide.')
        const { game, added } = await joinTeamAuctionLobby(socket, gameId, userId)
        if (added) await emitTeamAuctionState(gameId)
        else socket.emit('team-auction:state', await teamAuctionPublicState(game))
      } catch (error) { socket.emit('team-auction:error', { message: teamAuctionError(error) }) }
    })
    socket.on('team-auction:action', async (payload: { gameId?: unknown; action?: unknown; amount?: unknown; teamIndex?: unknown }) => {
      try {
        const gameId = payload?.gameId
        if (typeof gameId !== 'string' || socket.data.gameId !== gameId) throw new Error('Rejoins le salon avant de jouer.')
        if (payload.action === 'bid' && typeof payload.amount === 'number') submitTeamBid(gameId, userId, payload.amount)
        else if (payload.action === 'pass') passTeamBid(gameId, userId)
        else if (payload.action === 'allin') allInTeamBid(gameId, userId)
        else if (payload.action === 'place' && typeof payload.teamIndex === 'number') placeTeamCard(gameId, userId, payload.teamIndex)
        else throw new Error('Action Team Auction invalide.')
        advanceTeamAuction(gameId)
        await emitTeamAuctionState(gameId)
      } catch (error) { socket.emit('team-auction:error', { message: teamAuctionError(error) }) }
    })
    socket.on('team-auction:leave', async (gameId: unknown) => {
      if (typeof gameId !== 'string' || !gameId) return
      await socket.leave(`team-auction:${gameId}`)
      socket.data.gameId = undefined
      const game = getTeamAuctionGame(gameId)
      if (!game || game.phase !== 'LOBBY' || teamAuctionHosts.get(gameId) === userId) return
      const remaining = await io.in(`team-auction:${gameId}`).fetchSockets()
      if (remaining.some((other) => (other.data as SocketData).userId === userId)) return
      const index = game.players.findIndex((player) => player.id === userId)
      if (index === -1) return
      game.players.splice(index, 1)
      await emitTeamAuctionState(gameId)
    })
    socket.on('game:join', async (gameId: unknown, acknowledge?: (response: unknown) => void) => {
      try {
        if (typeof gameId !== 'string' || !gameId) throw Object.assign(new Error('Identifiant de partie invalide.'), { statusCode: 400 })
        const state = await getGameForUser(userId, gameId)
        await socket.join(`game:${gameId}`)
        socket.data.gameId = gameId
        socket.emit('game:state', state)
        acknowledge?.({ ok: true })
      } catch (error) {
        socket.emit('game:error', { message: error instanceof Error ? error.message : 'Impossible de rejoindre la partie.' })
        acknowledge?.({ ok: false, message: error instanceof Error ? error.message : 'Impossible de rejoindre la partie.' })
      }
    })
    socket.on('game:request-state', async () => {
      const gameId = socket.data.gameId
      if (typeof gameId !== 'string') return
      try { socket.emit('game:state', await getGameForUser(userId, gameId)) } catch (error) { socket.emit('game:error', { message: error instanceof Error ? error.message : 'État indisponible.' }) }
    })
    socket.on('game:draw', async (gameId: unknown) => {
      if (typeof gameId !== 'string' || socket.data.gameId !== gameId) return socket.emit('game:error', { message: 'Rejoins la partie avant de jouer.' })
      try {
        await drawCard(userId, gameId)
        await emitState(gameId)
      } catch (error) {
        const message = error instanceof Error && /Transaction API error|Unable to start a transaction|Prisma|transaction|timeout|deadlock/i.test(error.message)
          ? 'Impossible de démarrer la partie. Réessaie.'
          : (error instanceof Error ? error.message : 'Tirage refusé.')
        socket.emit('game:error', { message })
      }
    })
    socket.on('game:place-card', async (payload: { gameId?: unknown; category?: unknown }) => {
      const gameId = payload?.gameId
      if (typeof gameId !== 'string' || socket.data.gameId !== gameId) return socket.emit('game:error', { message: 'Rejoins la partie avant de jouer.' })
      try { await placeCard(userId, gameId, payload.category); await emitState(gameId) } catch (error) {
        const message = error instanceof Error && /Transaction API error|Unable to start a transaction|Prisma|transaction|timeout|deadlock/i.test(error.message)
          ? 'Impossible de démarrer la partie. Réessaie.'
          : (error instanceof Error ? error.message : 'Placement refusé.')
        socket.emit('game:error', { message })
      }
    })
  })

  return io
}

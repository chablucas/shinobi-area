import { randomUUID } from 'node:crypto'
import { getCardKnowledgeById, listCardKnowledge } from '../game/cardKnowledge.js'
import { teamAuctionRules, normalizeBid, isValidBid, getMinimumOpenBid } from '../game/teamAuctionRules.js'
import { calculateCharacterOverallScore, calculateTeamScore, resolveFinalStandings } from '../game/teamMode.js'
import { pickTeamPlacementForCard, teamAuctionAiDecision } from '../game/teamAuctionAi.js'

export type TeamAuctionMode = '1v1-ai' | '1v1-real' | '1v1v1-real'
export type TeamAuctionPhase = 'LOBBY' | 'DRAW' | 'BIDDING' | 'PLACEMENT' | 'RESULTS' | 'FINISHED'
export type TeamAuctionPlayerId = string | number

export type TeamAuctionPlayer = {
  id: TeamAuctionPlayerId
  displayName: string
  isAi: boolean
  budget: number
  teams: number[][]
  passedCurrentRound: boolean
  activeCurrentRound: boolean
}

export type TeamAuctionGame = {
  gameId: string
  mode: TeamAuctionMode
  phase: TeamAuctionPhase
  players: TeamAuctionPlayer[]
  teamSizes: number[]
  initialBudget: number
  deck: number[]
  usedCardIds: number[]
  currentCardId: number | null
  currentBid: number
  currentBidderId: TeamAuctionPlayerId | null
  currentTurnId: TeamAuctionPlayerId | null
  openerIndex: number
  roundNumber: number
  winnerId: TeamAuctionPlayerId | null
  finalResults: {
    winnerId: TeamAuctionPlayerId | null
    winners: TeamAuctionPlayerId[]
    teams: Array<{ playerId: TeamAuctionPlayerId; teamNumber: number; score: number; won: boolean }>
    summary: Array<{ playerId: TeamAuctionPlayerId; victories: number; totalTeamScore: number }>
    draw: boolean
  } | null
}

export type TeamAuctionGameConfig = {
  gameId?: string
  mode: TeamAuctionMode
  players: Array<{ id: TeamAuctionPlayerId; displayName: string; isAi?: boolean }>
  teamSizes: number[]
  initialBudget: number
}

const games = new Map<string, TeamAuctionGame>()

function validateTeamConfig(teamSizes: number[], initialBudget: number, mode: TeamAuctionMode) {
  if (!teamSizes.length || teamSizes.some((size) => !Number.isInteger(size) || size <= 0)) {
    throw new Error('La configuration des équipes est invalide.')
  }
  if (!Number.isFinite(initialBudget) || initialBudget <= 0) {
    throw new Error('Le budget initial est invalide.')
  }
  const expectedPlayers = mode === '1v1-real' || mode === '1v1-ai' ? 2 : 3
  if (teamSizes.length < 1) {
    throw new Error('Une équipe au moins est requise.')
  }
  if (expectedPlayers !== 2 && expectedPlayers !== 3) {
    throw new Error('Mode de jeu invalide.')
  }
}

function shuffle<T>(values: T[]): T[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function cardById(cardId: number) {
  return getCardKnowledgeById(cardId)
}

function playerById(game: TeamAuctionGame, playerId: TeamAuctionPlayerId) {
  return game.players.find((player) => player.id === playerId)
}

function totalRequiredCards(teamSizes: number[]) {
  return teamSizes.reduce((sum, size) => sum + size, 0)
}

function resetRoundState(game: TeamAuctionGame) {
  for (const player of game.players) {
    player.activeCurrentRound = true
    player.passedCurrentRound = false
  }
  game.currentBid = 0
  game.currentBidderId = null
  game.roundNumber += 1
}

function nextNonPassedPlayerIndex(game: TeamAuctionGame, startIndex: number) {
  const playerCount = game.players.length
  for (let offset = 1; offset <= playerCount; offset += 1) {
    const candidateIndex = (startIndex + offset) % playerCount
    const candidate = game.players[candidateIndex]!
    if (!candidate.passedCurrentRound && candidate.activeCurrentRound) {
      return candidateIndex
    }
  }
  return startIndex
}

export function minimumNextTeamBid(game: Pick<TeamAuctionGame, 'currentBid'>) {
  return game.currentBid === 0 ? teamAuctionRules.openingBid : game.currentBid + teamAuctionRules.bidUnit
}

export function canPlayerRaise(player: TeamAuctionPlayer, game: Pick<TeamAuctionGame, 'currentBid'>) {
  return !player.passedCurrentRound && player.activeCurrentRound && minimumNextTeamBid(game) <= player.budget
}

function refreshBiddingEligibility(game: TeamAuctionGame) {
  for (const player of game.players) {
    if (!player.passedCurrentRound) player.activeCurrentRound = canPlayerRaise(player, game)
  }
}

function nextEligiblePlayerIndex(game: TeamAuctionGame, startIndex: number) {
  const playerCount = game.players.length
  for (let offset = 1; offset <= playerCount; offset += 1) {
    const candidateIndex = (startIndex + offset) % playerCount
    const candidate = game.players[candidateIndex]!
    if (canPlayerRaise(candidate, game)) return candidateIndex
  }
  return null
}

function advanceOrResolveBidding(game: TeamAuctionGame, startIndex: number) {
  refreshBiddingEligibility(game)
  const nextIndex = nextEligiblePlayerIndex(game, startIndex)
  if (game.currentBidderId !== null && (nextIndex === null || game.players[nextIndex]?.id === game.currentBidderId)) {
    finishRound(game)
    return
  }
  if (nextIndex === null) {
    game.phase = 'DRAW'
    game.currentCardId = null
    game.currentBid = 0
    game.currentBidderId = null
    game.currentTurnId = null
    return
  }
  game.currentTurnId = game.players[nextIndex]!.id
}

function allTeamsComplete(game: TeamAuctionGame) {
  return game.players.every((player) => player.teams.every((team) => team.length === (game.teamSizes[player.teams.indexOf(team)] ?? 0)))
}

function finishRound(game: TeamAuctionGame) {
  const hasBid = game.currentBid > 0 && game.currentBidderId !== null
  const winner = hasBid ? playerById(game, game.currentBidderId!) : null

  if (!winner) {
    game.phase = 'DRAW'
    game.currentCardId = null
    game.currentBid = 0
    game.currentBidderId = null
    return
  }

  winner.budget = Math.max(0, winner.budget - game.currentBid)
  game.phase = 'PLACEMENT'
  game.winnerId = winner.id
  game.currentTurnId = winner.id
}

function computeFinalResults(game: TeamAuctionGame) {
  const teamParticipants = game.players.map((player) => ({
    id: player.id,
    teams: player.teams.map((teamCardIds) => teamCardIds.map((cardId) => {
      const card = cardById(cardId)
      return { name: card?.name ?? String(cardId), stats: card?.stats ?? {} }
    })),
  }))

  const { standings } = resolveFinalStandings(teamParticipants as Array<{ id: number | string; teams: any[][] }>)
  const best = standings[0]!
  const winners = standings
    .filter((standing) => standing.victories === best.victories && Math.abs(standing.totalTeamScore - best.totalTeamScore) < 1e-9)
    .map((standing) => standing.playerId)

  const draw = winners.length > 1
  const winnerId = draw ? null : best.playerId

  game.finalResults = {
    winnerId,
    winners,
    teams: standings.flatMap((standing) => standing.teamResults.map((teamResult) => ({
      playerId: standing.playerId,
      teamNumber: teamResult.teamNumber,
      score: teamResult.score,
      won: teamResult.won,
    }))),
    summary: standings.map((standing) => ({
      playerId: standing.playerId,
      victories: standing.victories,
      totalTeamScore: standing.totalTeamScore,
    })),
    draw: Boolean(draw),
  }

  game.phase = 'RESULTS'
}

export function createTeamAuctionGame(config: TeamAuctionGameConfig): TeamAuctionGame {
  validateTeamConfig(config.teamSizes, config.initialBudget, config.mode)
  const game: TeamAuctionGame = {
    gameId: config.gameId ?? randomUUID(),
    mode: config.mode,
    phase: 'LOBBY',
    players: config.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      isAi: Boolean(player.isAi),
      budget: config.initialBudget,
      teams: config.teamSizes.map(() => [] as number[]),
      passedCurrentRound: false,
      activeCurrentRound: true,
    })),
    teamSizes: [...config.teamSizes],
    initialBudget: config.initialBudget,
    deck: shuffle(listCardKnowledge().map((card) => card.id)),
    usedCardIds: [],
    currentCardId: null,
    currentBid: 0,
    currentBidderId: null,
    currentTurnId: null,
    openerIndex: 0,
    roundNumber: 0,
    winnerId: null,
    finalResults: null,
  }
  games.set(game.gameId, game)
  return game
}

export function getTeamAuctionGame(gameId: string) {
  return games.get(gameId) ?? null
}

export function startTeamAuctionGame(gameId: string) {
  const game = games.get(gameId)
  if (!game) throw new Error('Partie introuvable.')
  if (game.phase !== 'LOBBY') throw new Error('La partie a déjà commencé.')
  game.phase = 'DRAW'
  game.openerIndex = 0
  game.currentBid = 0
  game.currentBidderId = null
  resetRoundState(game)
  game.currentTurnId = game.players[0]?.id ?? null
  return game
}

export function drawNextTeamCard(gameId: string) {
  const game = games.get(gameId)
  if (!game) throw new Error('Partie introuvable.')
  if (game.phase !== 'DRAW') throw new Error('La phase actuelle n’autorise pas de piège.')
  const nextCardId = game.deck.pop()
  if (!nextCardId) {
    game.phase = 'RESULTS'
    computeFinalResults(game)
    return game
  }
  game.usedCardIds.push(nextCardId)
  game.currentCardId = nextCardId
  resetRoundState(game)
  const openerIndex = game.openerIndex % game.players.length
  game.currentTurnId = game.players[openerIndex]?.id ?? null
  game.phase = 'BIDDING'
  return game
}

export function submitTeamBid(gameId: string, playerId: TeamAuctionPlayerId, amount: number) {
  const game = games.get(gameId)
  if (!game) throw new Error('Partie introuvable.')
  if (game.phase !== 'BIDDING') throw new Error('La phase actuelle ne permet pas d’enchérir.')
  const player = playerById(game, playerId)
  if (!player) throw new Error('Joueur introuvable.')
  if (game.currentTurnId !== playerId) throw new Error('Ce n’est pas ton tour.')
  const minimumBid = game.currentBid === 0 ? getMinimumOpenBid(player.budget) : game.currentBid + teamAuctionRules.bidUnit
  if (!isValidBid(amount, game.currentBid, player.budget)) {
    throw new Error('Enchère invalide.')
  }
  if (amount < minimumBid) {
    throw new Error('Le montant doit respecter le prix minimum de l’enchère.')
  }
  player.activeCurrentRound = true
  player.passedCurrentRound = false
  game.currentBid = normalizeBid(amount, player.budget)
  game.currentBidderId = playerId

  const currentIndex = game.players.findIndex((entry) => entry.id === playerId)
  advanceOrResolveBidding(game, currentIndex)

  return game
}

export function passTeamBid(gameId: string, playerId: TeamAuctionPlayerId) {
  const game = games.get(gameId)
  if (!game) throw new Error('Partie introuvable.')
  if (game.phase !== 'BIDDING') throw new Error('La phase actuelle ne permet pas de passer.')
  const player = playerById(game, playerId)
  if (!player) throw new Error('Joueur introuvable.')
  if (game.currentTurnId !== playerId) throw new Error('Ce n’est pas ton tour.')
  if (player.passedCurrentRound) throw new Error('Ce joueur a déjà passé cette carte.')

  player.passedCurrentRound = true
  player.activeCurrentRound = false
  const currentIndex = game.players.findIndex((candidate) => candidate.id === playerId)
  advanceOrResolveBidding(game, currentIndex)

  return game
}

export function allInTeamBid(gameId: string, playerId: TeamAuctionPlayerId) {
  const game = games.get(gameId)
  if (!game) throw new Error('Partie introuvable.')
  if (!teamAuctionRules.allowAllIn) throw new Error('Le ALL-IN est désactivé.')
  const player = playerById(game, playerId)
  if (!player) throw new Error('Joueur introuvable.')
  const allInAmount = Math.floor(player.budget / teamAuctionRules.bidUnit) * teamAuctionRules.bidUnit
  if (allInAmount < minimumNextTeamBid(game)) throw new Error('Le ALL-IN doit dépasser l’enchère actuelle.')
  return submitTeamBid(gameId, playerId, allInAmount)
}

export function placeTeamCard(gameId: string, playerId: TeamAuctionPlayerId, teamIndex: number) {
  const game = games.get(gameId)
  if (!game) throw new Error('Partie introuvable.')
  if (game.phase !== 'PLACEMENT') throw new Error('La phase actuelle n’autorise pas le placement.')
  if (game.winnerId !== playerId) throw new Error('Ce joueur n’a pas gagné la carte.')
  if (teamIndex < 0 || teamIndex >= game.teamSizes.length) throw new Error('Équipe invalide.')
  if (game.currentCardId === null) throw new Error('Aucune carte à placer.')

  const player = playerById(game, playerId)
  if (!player) throw new Error('Joueur introuvable.')
  const targetTeam = player.teams[teamIndex]
  if (!targetTeam) throw new Error('Équipe introuvable.')
  if (targetTeam.length >= (game.teamSizes[teamIndex] ?? 0)) throw new Error('Cette équipe est complète.')

  player.teams[teamIndex].push(game.currentCardId)
  game.usedCardIds.push(game.currentCardId)
  game.currentCardId = null
  game.currentBid = 0
  game.currentBidderId = null
  game.currentTurnId = null
  game.winnerId = null

  game.openerIndex = (game.openerIndex + 1) % game.players.length

  if (allTeamsComplete(game)) {
    computeFinalResults(game)
    game.phase = 'RESULTS'
    return game
  }

  game.phase = 'DRAW'
  return game
}

export function evaluateTeamAuctionAi(gameId: string, playerId: TeamAuctionPlayerId) {
  const game = games.get(gameId)
  if (!game) throw new Error('Partie introuvable.')
  return teamAuctionAiDecision(game, playerId)
}

export function chooseAiPlacement(gameId: string, playerId: TeamAuctionPlayerId, cardId: number) {
  const game = games.get(gameId)
  if (!game) throw new Error('Partie introuvable.')
  return pickTeamPlacementForCard(game, playerId, cardId)
}

export function getTeamAuctionPlayers(gameId: string) {
  return games.get(gameId)?.players ?? []
}

export const __teamAuctionGames = games

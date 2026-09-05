import { getTeamAuctionPowerScore } from './teamAuctionPower.js'

export type TeamMember = { name?: string; slug?: string; stats?: Record<string, unknown> }

export type TeamMatchup = {
  teamNumber: number
  left: TeamMember[]
  right: TeamMember[]
  leftScore: number
  rightScore: number
  winner: 'left' | 'right' | 'draw'
}

export type TeamStanding = {
  playerId: number | string
  victories: number
  totalTeamScore: number
  teamResults: Array<{ teamNumber: number; score: number; won: boolean; draw: boolean }>
}

const TEAM_SCORE_EXCLUDED_KEYS = new Set(['clan', 'sensory'])

function numericStats(stats: Record<string, unknown> | null | undefined): Array<[string, number]> {
  if (!stats || typeof stats !== 'object') return []
  return Object.entries(stats)
    .filter(([key, value]) => !TEAM_SCORE_EXCLUDED_KEYS.has(key) && typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => [key, Number(value)])
}

export function calculateCharacterOverallScore(card: TeamMember | Record<string, unknown> | null | undefined): number {
  const stats = card && typeof card === 'object' && 'stats' in card && card.stats && typeof card.stats === 'object'
    ? (card.stats as Record<string, unknown>)
    : ((card ?? {}) as Record<string, unknown>)

  const entries = numericStats(stats)
  if (!entries.length) return 0

  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  const score = total / entries.length
  return Number(Math.min(100, Math.max(0, score)).toFixed(10))
}

export const calculateOverallScore = calculateCharacterOverallScore

export function calculateTeamAuctionCharacterScore(card: TeamMember | Record<string, unknown> | null | undefined): number {
  const slug = card && typeof card === 'object' && typeof card.slug === 'string' ? card.slug : null
  if (!slug) throw new Error('Une carte Team Auction doit fournir son slug canonique.')
  return getTeamAuctionPowerScore(slug)
}

export function calculateTeamAuctionScore(team: TeamMember[]): number {
  if (!team.length) return 0
  const total = team.reduce((sum, member) => sum + calculateTeamAuctionCharacterScore(member), 0)
  return Number((total / team.length).toFixed(10))
}

export function calculateTeamScore(team: TeamMember[]): number {
  if (!team.length) return 0
  const total = team.reduce((sum, member) => sum + calculateCharacterOverallScore(member), 0)
  return Number((total / team.length).toFixed(10))
}
export const calculateTeamOverall = calculateTeamScore

type CardScoreFn = (card: TeamMember | Record<string, unknown> | null | undefined) => number
type TeamScoreFn = (team: TeamMember[]) => number

function evaluateTeamPlacementWith(
  scoreCard: CardScoreFn,
  scoreTeam: TeamScoreFn,
  card: TeamMember,
  team: TeamMember[],
  opponentTeam: TeamMember[],
  options: { teamSize?: number; remainingSlots?: number; budgetRemaining?: number; strategicNeed?: number } = {},
): number {
  const cardScore = scoreCard(card)
  const teamAverage = scoreTeam(team)
  const opponentAverage = scoreTeam(opponentTeam)
  const targetTeamSize = Number(options.teamSize ?? (team.length > 0 ? team.length : 1))
  const projectedTeamAverage = team.length > 0
    ? ((teamAverage * team.length) + cardScore) / (team.length + 1)
    : cardScore

  const teamPressure = targetTeamSize > 0 ? Math.max(0, targetTeamSize - team.length) / targetTeamSize : 0
  const impactOnOpponentGap = projectedTeamAverage - opponentAverage
  const remainingSlots = Math.max(0, options.remainingSlots ?? 0)
  const budgetRemaining = Math.max(0, options.budgetRemaining ?? 0)
  const strategicNeed = Math.max(0, options.strategicNeed ?? 0)

  return Number((
    cardScore * (1 + teamPressure * 0.25)
    + impactOnOpponentGap * 2.4
    + (team.length === 0 ? 8 : 0)
    + Math.max(0, 18 - Math.abs(team.length - targetTeamSize) * 4)
    + remainingSlots * 0.3
    + Math.min(budgetRemaining / 100, 6)
    + strategicNeed * 4
  ).toFixed(10))
}

function chooseBestTeamPlacementWith(
  scoreCard: CardScoreFn,
  scoreTeam: TeamScoreFn,
  card: TeamMember,
  teams: Array<{ members: TeamMember[]; opponent: TeamMember[]; size: number }>,
  options: { remainingSlots?: number; budgetRemaining?: number; strategicNeed?: number } = {},
): { teamIndex: number; score: number } | null {
  if (!teams.length) return null

  const scored = teams
    .map((team, index) => ({
      teamIndex: index,
      score: evaluateTeamPlacementWith(scoreCard, scoreTeam, card, team.members, team.opponent, { ...options, teamSize: team.size }),
    }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  return best ? { teamIndex: best.teamIndex, score: best.score } : null
}

/** Variante Team Auction : la valeur intrinsèque vient de generalScore, jamais des statistiques. */
export function evaluateTeamAuctionPlacement(
  card: TeamMember,
  team: TeamMember[],
  opponentTeam: TeamMember[],
  options: { teamSize?: number; remainingSlots?: number; budgetRemaining?: number; strategicNeed?: number } = {},
): number {
  return evaluateTeamPlacementWith(calculateTeamAuctionCharacterScore, calculateTeamAuctionScore, card, team, opponentTeam, options)
}

export function chooseBestTeamAuctionPlacement(
  card: TeamMember,
  teams: Array<{ members: TeamMember[]; opponent: TeamMember[]; size: number }>,
  options: { remainingSlots?: number; budgetRemaining?: number; strategicNeed?: number } = {},
): { teamIndex: number; score: number } | null {
  return chooseBestTeamPlacementWith(calculateTeamAuctionCharacterScore, calculateTeamAuctionScore, card, teams, options)
}

export function resolveTeamConfrontation(teamA: TeamMember[], teamB: TeamMember[]): TeamMatchup {
  const leftScore = calculateTeamScore(teamA)
  const rightScore = calculateTeamScore(teamB)

  if (Math.abs(leftScore - rightScore) < 1e-9) {
    return { teamNumber: 0, left: teamA, right: teamB, leftScore, rightScore, winner: 'draw' }
  }

  return {
    teamNumber: 0,
    left: teamA,
    right: teamB,
    leftScore,
    rightScore,
    winner: leftScore > rightScore ? 'left' : 'right',
  }
}

export function resolveFinalStandings<T extends { id: number | string; teams: TeamMember[][] }>(players: T[]): {
  standings: TeamStanding[]
  matchups: TeamMatchup[]
} {
  const maxTeamCount = players.reduce((max, player) => Math.max(max, player.teams.length), 0)
  const matchups: TeamMatchup[] = []
  const standings = players.map((player) => ({
    playerId: player.id,
    victories: 0,
    totalTeamScore: 0,
    teamResults: [] as Array<{ teamNumber: number; score: number; won: boolean; draw: boolean }>,
  }))

  for (let teamNumber = 0; teamNumber < maxTeamCount; teamNumber += 1) {
    const entrants = players
      .map((player, index) => ({ playerIndex: index, player, team: player.teams[teamNumber] ?? [] }))
      .filter((entry) => entry.team.length > 0)

    if (entrants.length < 2) continue

    const results = entrants.map((entry) => ({
      ...entry,
      score: calculateTeamScore(entry.team),
    }))

    const highest = Math.max(...results.map((entry) => entry.score))
    const winners = results.filter((entry) => Math.abs(entry.score - highest) < 1e-9)

    for (const winner of winners) {
      standings[winner.playerIndex]!.victories += 1
    }

    for (let i = 0; i < results.length; i += 1) {
      const current = results[i]!
      standings[current.playerIndex]!.totalTeamScore += current.score
      standings[current.playerIndex]!.teamResults.push({
        teamNumber: teamNumber + 1,
        score: current.score,
        won: winners.some((entry) => entry.playerIndex === current.playerIndex),
        draw: winners.length > 1,
      })
    }

    if (results.length === 2) {
      const left = results[0]!
      const right = results[1]!
      const leftScore = left.score
      const rightScore = right.score
      matchups.push({
        teamNumber: teamNumber + 1,
        left: left.team,
        right: right.team,
        leftScore,
        rightScore,
        winner: Math.abs(leftScore - rightScore) < 1e-9 ? 'draw' : leftScore > rightScore ? 'left' : 'right',
      })
    }
  }

  standings.sort((a, b) => {
    if (b.victories !== a.victories) return b.victories - a.victories
    if (Math.abs(b.totalTeamScore - a.totalTeamScore) > 1e-9) return b.totalTeamScore - a.totalTeamScore
    return 0
  })

  return { standings, matchups }
}

/** Variante Team Auction : classement final basé uniquement sur generalScore. */
export function resolveTeamAuctionFinalStandings<T extends { id: number | string; teams: TeamMember[][] }>(players: T[]): {
  standings: TeamStanding[]
  matchups: TeamMatchup[]
} {
  const maxTeamCount = players.reduce((max, player) => Math.max(max, player.teams.length), 0)
  const matchups: TeamMatchup[] = []
  const standings = players.map((player) => ({
    playerId: player.id,
    victories: 0,
    totalTeamScore: 0,
    teamResults: [] as Array<{ teamNumber: number; score: number; won: boolean; draw: boolean }>,
  }))

  for (let teamNumber = 0; teamNumber < maxTeamCount; teamNumber += 1) {
    const entrants = players
      .map((player, index) => ({ playerIndex: index, player, team: player.teams[teamNumber] ?? [] }))
      .filter((entry) => entry.team.length > 0)

    if (entrants.length < 2) continue

    const results = entrants.map((entry) => ({
      ...entry,
      score: calculateTeamAuctionScore(entry.team),
    }))

    const highest = Math.max(...results.map((entry) => entry.score))
    const winners = results.filter((entry) => Math.abs(entry.score - highest) < 1e-9)

    for (const winner of winners) {
      standings[winner.playerIndex]!.victories += 1
    }

    for (let i = 0; i < results.length; i += 1) {
      const current = results[i]!
      standings[current.playerIndex]!.totalTeamScore += current.score
      standings[current.playerIndex]!.teamResults.push({
        teamNumber: teamNumber + 1,
        score: current.score,
        won: winners.some((entry) => entry.playerIndex === current.playerIndex),
        draw: winners.length > 1,
      })
    }

    if (results.length === 2) {
      const left = results[0]!
      const right = results[1]!
      const leftScore = left.score
      const rightScore = right.score
      matchups.push({
        teamNumber: teamNumber + 1,
        left: left.team,
        right: right.team,
        leftScore,
        rightScore,
        winner: Math.abs(leftScore - rightScore) < 1e-9 ? 'draw' : leftScore > rightScore ? 'left' : 'right',
      })
    }
  }

  standings.sort((a, b) => {
    if (b.victories !== a.victories) return b.victories - a.victories
    if (Math.abs(b.totalTeamScore - a.totalTeamScore) > 1e-9) return b.totalTeamScore - a.totalTeamScore
    return 0
  })

  return { standings, matchups }
}

export function normalizeTeamConfig(input: { teamSizes?: number[]; initialBudget?: number; teamCount?: number } | null | undefined): {
  teamCount: number
  teamSizes: number[]
  initialBudget: number
} {
  const teamSizes = Array.isArray(input?.teamSizes) ? input.teamSizes.map((size) => Number(size)) : []
  const normalized = teamSizes.filter((size) => Number.isInteger(size) && size > 0)
  if (!normalized.length) {
    throw new Error('La configuration doit contenir au moins une équipe valide.')
  }

  const initialBudget = Number(input?.initialBudget ?? 0)
  if (!Number.isFinite(initialBudget) || initialBudget <= 0) {
    throw new Error('Le budget initial doit être un nombre positif.')
  }

  const teamCount = Number(input?.teamCount ?? normalized.length)
  if (!Number.isInteger(teamCount) || teamCount < normalized.length) {
    throw new Error('Le nombre d’équipes ne peut pas être inférieur au nombre de tailles fournies.')
  }

  return { teamCount, teamSizes: normalized, initialBudget }
}

export function evaluateTeamPlacement(card: TeamMember, team: TeamMember[], opponentTeam: TeamMember[], options: {
  teamSize?: number
  remainingSlots?: number
  budgetRemaining?: number
  strategicNeed?: number
} = {}): number {
  const cardScore = calculateCharacterOverallScore(card)
  const teamAverage = calculateTeamScore(team)
  const opponentAverage = calculateTeamScore(opponentTeam)
  const targetTeamSize = Number(options.teamSize ?? (team.length > 0 ? team.length : 1))
  const projectedTeamAverage = team.length > 0
    ? ((teamAverage * team.length) + cardScore) / (team.length + 1)
    : cardScore

  const teamPressure = targetTeamSize > 0 ? Math.max(0, targetTeamSize - team.length) / targetTeamSize : 0
  const impactOnOpponentGap = projectedTeamAverage - opponentAverage
  const remainingSlots = Math.max(0, options.remainingSlots ?? 0)
  const budgetRemaining = Math.max(0, options.budgetRemaining ?? 0)
  const strategicNeed = Math.max(0, options.strategicNeed ?? 0)

  return Number((
    cardScore * (1 + teamPressure * 0.25)
    + impactOnOpponentGap * 2.4
    + (team.length === 0 ? 8 : 0)
    + Math.max(0, 18 - Math.abs(team.length - targetTeamSize) * 4)
    + remainingSlots * 0.3
    + Math.min(budgetRemaining / 100, 6)
    + strategicNeed * 4
  ).toFixed(10))
}

export function chooseBestTeamPlacement(
  card: TeamMember,
  teams: Array<{ members: TeamMember[]; opponent: TeamMember[]; size: number }>,
  options: { remainingSlots?: number; budgetRemaining?: number; strategicNeed?: number } = {},
): { teamIndex: number; score: number } | null {
  if (!teams.length) return null

  const scored = teams
    .map((team, index) => ({ teamIndex: index, score: evaluateTeamPlacement(card, team.members, team.opponent, { ...options, teamSize: team.size }) }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  return best ? { teamIndex: best.teamIndex, score: best.score } : null
}

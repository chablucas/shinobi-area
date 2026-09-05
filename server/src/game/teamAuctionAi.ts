import { getCardKnowledgeById, listCardKnowledge } from './cardKnowledge.js'
import { calculateCharacterOverallScore, calculateTeamScore, chooseBestTeamPlacement } from './teamMode.js'
import type { TeamAuctionGame, TeamAuctionPlayer } from '../services/teamAuctionGameService.js'

function teamCardsScore(teamCards: number[], game: TeamAuctionGame): number {
  if (!teamCards.length) return 0
  return calculateTeamScore(teamCards.map((cardId) => {
    const card = getCardKnowledgeById(cardId)
    return { name: card?.name ?? String(cardId), stats: card?.stats ?? {} }
  }))
}

function makePlacementInput(game: TeamAuctionGame, player: TeamAuctionPlayer, cardId: number) {
  const card = getCardKnowledgeById(cardId)
  if (!card) return null

  const teams = player.teams.map((team, index) => {
    const opponent = game.players
      .filter((candidate) => candidate.id !== player.id)
      .map((candidate) => candidate.teams[index] ?? [])
      .flat()
      .map((opponentCardId) => ({
        name: getCardKnowledgeById(opponentCardId)?.name ?? String(opponentCardId),
        stats: getCardKnowledgeById(opponentCardId)?.stats ?? {},
      }))

    return {
      members: team.map((memberId) => ({
        name: getCardKnowledgeById(memberId)?.name ?? String(memberId),
        stats: getCardKnowledgeById(memberId)?.stats ?? {},
      })),
      opponent: opponent.length ? opponent : [],
      size: game.teamSizes[index] ?? 1,
    }
  })

  return {
    card: { name: card.name, stats: card.stats },
    teams: teams.filter((team) => (team.members.length ?? 0) < (game.teamSizes[teams.indexOf(team)] ?? 1)),
  }
}

export function teamAuctionAiDecision(game: TeamAuctionGame, playerId: TeamAuctionPlayer['id']) {
  const player = game.players.find((candidate) => candidate.id === playerId)
  if (!player || game.currentCardId == null || game.currentTurnId !== playerId) return null

  const currentCard = getCardKnowledgeById(game.currentCardId)
  if (!currentCard) return { action: 'pass' as const }

  const currentScore = calculateCharacterOverallScore(currentCard)
  const deck = listCardKnowledge().map((card) => ({ card, score: calculateCharacterOverallScore(card) }))
  const sorted = [...deck].sort((a, b) => b.score - a.score)
  const rank = sorted.findIndex((entry) => entry.card.id === currentCard.id) + 1
  const totalCardsNeeded = game.teamSizes.reduce((sum, size) => sum + size, 0)
  const owned = player.teams.flat().length
  const cardsStillNeeded = Math.max(1, totalCardsNeeded - owned)
  const budgetAverage = player.budget / cardsStillNeeded
  const placementInput = makePlacementInput(game, player, game.currentCardId)
  const placementScore = placementInput
    ? Math.max(...placementInput.teams.map((team, index) => {
        const candidate = chooseBestTeamPlacement(
          { name: currentCard.name, stats: currentCard.stats },
          [
            { members: team.members, opponent: team.opponent, size: team.size },
          ],
          { remainingSlots: Math.max(0, (game.teamSizes[index] ?? 1) - team.members.length), budgetRemaining: player.budget, strategicNeed: Math.max(0, 3 - cardsStillNeeded) },
        )
        return candidate?.score ?? 0
      }))
    : 0

  const topCardBias = currentScore >= 90 ? 240 : 0
  const weakCardBias = currentScore <= 40 ? -180 : 0
  const budgetPressure = budgetAverage > 0 ? Math.min(200, (player.budget / budgetAverage) * 22) : 0
  const rankBias = Math.max(0, 200 - rank * 8)
  const maxReasonableBid = Math.min(
    player.budget,
    Math.max(10, Math.round(currentScore * 2 + rankBias + placementScore * 2 + topCardBias + weakCardBias + budgetPressure)),
  )

  if (currentScore <= 40 && game.currentBid >= Math.min(30, Math.round(budgetAverage * 0.75))) {
    return { action: 'pass' as const }
  }

  if (game.currentBid > 0 && game.currentBid >= maxReasonableBid) {
    return { action: 'pass' as const }
  }

  if (currentScore >= 96 && cardsStillNeeded <= 2) {
    return { action: 'allin' as const }
  }

  if (game.currentBid === 0 && currentScore >= 80 && cardsStillNeeded <= 3) {
    return { action: 'bid' as const, amount: Math.min(player.budget, Math.max(10, Math.min(maxReasonableBid, 200))) }
  }

  if (game.currentBid === 0) {
    return { action: 'bid' as const, amount: Math.min(player.budget, Math.max(10, Math.min(maxReasonableBid, 80))) }
  }

  const raise = Math.min(player.budget, Math.max(game.currentBid + 10, Math.min(maxReasonableBid, game.currentBid + 30)))
  if (raise <= game.currentBid) return { action: 'pass' as const }
  return { action: 'bid' as const, amount: raise }
}

export function pickTeamPlacementForCard(game: TeamAuctionGame, playerId: TeamAuctionPlayer['id'], cardId: number) {
  const player = game.players.find((candidate) => candidate.id === playerId)
  if (!player) return null
  const card = getCardKnowledgeById(cardId)
  if (!card) return null

  const options = player.teams
    .map((team, index) => ({
      teamIndex: index,
      members: team.map((memberId) => ({ name: getCardKnowledgeById(memberId)?.name ?? String(memberId), stats: getCardKnowledgeById(memberId)?.stats ?? {} })),
      opponent: game.players
        .filter((candidate) => candidate.id !== playerId)
        .map((candidate) => candidate.teams[index] ?? [])
        .flat()
        .map((memberId) => ({ name: getCardKnowledgeById(memberId)?.name ?? String(memberId), stats: getCardKnowledgeById(memberId)?.stats ?? {} })),
      size: game.teamSizes[index] ?? 1,
    }))
    .filter((option) => option.members.length < (game.teamSizes[option.teamIndex] ?? 1))

  if (!options.length) return null

  const best = options
    .map((option, index) => ({
      index,
      score: chooseBestTeamPlacement(
        { name: card.name, stats: card.stats },
        [{ members: option.members, opponent: option.opponent, size: option.size }],
        { remainingSlots: (game.teamSizes[option.teamIndex] ?? 1) - option.members.length, budgetRemaining: player.budget, strategicNeed: Math.max(0, 3 - player.teams.flat().length) },
      )?.score ?? 0,
    }))
    .sort((a, b) => b.score - a.score)[0]

  return best ? options[best.index]?.teamIndex ?? null : null
}

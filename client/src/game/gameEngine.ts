import type { Card, Category } from '../types/card'

export type Player = {
  id: number
  name: string
  deck: Card[]
  score: number
}

export type Round = {
  number: number
  activePlayerId: number
  cards: Card[]
  category: Category | null
}

export type RoundOutcome = {
  winnerIds: number[]
  winningValue: number | null
  isTie: boolean
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = result[index]
    result[index] = result[swapIndex] as T
    result[swapIndex] = current as T
  }
  return result
}

export function createPlayers(cards: Card[], playerCount: number): Player[] {
  const shuffledCards = shuffle(cards)
  const cardsPerPlayer = Math.floor(shuffledCards.length / playerCount)
  return Array.from({ length: playerCount }, (_, index) => ({
    id: index,
    name: `Joueur ${index + 1}`,
    deck: shuffledCards.slice(index * cardsPerPlayer, (index + 1) * cardsPerPlayer),
    score: 0,
  }))
}

export function categoriesFor(card: Card): Category[] {
  return Object.keys(card.stats)
    .filter((slug) => card.stats[slug] !== null)
    .map((slug) => ({ slug, label: slug.replace(/-/g, ' ') }))
}

export function compareRound(cards: Card[], category: Category): RoundOutcome {
  const values = cards.map((card) => card.stats[category.slug] ?? Number.NEGATIVE_INFINITY)
  const winningValue = Math.max(...values)
  const winnerIds = values.flatMap((value, index) => (value === winningValue ? [index] : []))
  return { winnerIds, winningValue: Number.isFinite(winningValue) ? winningValue : null, isTie: winnerIds.length > 1 }
}

export function getRoundCards(players: Player[]): Card[] {
  return players.map((player) => player.deck[0]).filter((card): card is Card => Boolean(card))
}
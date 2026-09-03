import type { Card, Category } from '../types/card'

export const CATEGORY_DEFINITIONS = [
  ['Chakra', 'chakra'],
  ['Invocation', 'invocation'],
  ['IQ', 'iq'],
  ['Ninjutsu', 'ninjutsu'],
  ['Genjutsu', 'genjutsu'],
  ['Taijutsu', 'taijutsu'],
  ['Avatar', 'avatar'],
  ['Body', 'body'],
  ['Fūinjutsu', 'fuinjutsu'],
  ['Senjutsu', 'senjutsu'],
  ['Kenjutsu', 'kenjutsu'],
  ['Clan', 'clan'],
  ['Vitesse', 'vitesse'],
  ['Kekkei Genkai', 'kekkei-genkai'],
  ['Kekkei Mōra', 'kekkei-mora'],
] as const

export type CategorySlug = (typeof CATEGORY_DEFINITIONS)[number][1]

export const CATEGORIES: Category[] = CATEGORY_DEFINITIONS.map(([label, slug]) => ({ label, slug }))

export type PlayerBuild = {
  playerId: 1 | 2
  slots: Record<CategorySlug, Card | null>
}

export type ManualCombatResult = {
  winnerId: 1 | 2
}

function emptySlots(): Record<CategorySlug, Card | null> {
  return Object.fromEntries(CATEGORY_DEFINITIONS.map(([, slug]) => [slug, null])) as Record<CategorySlug, Card | null>
}

export function createPlayerBuild(playerId: 1 | 2): PlayerBuild {
  return { playerId, slots: emptySlots() }
}

export function createPlayerBuilds(): [PlayerBuild, PlayerBuild] {
  return [createPlayerBuild(1), createPlayerBuild(2)]
}

export function isBuildComplete(build: PlayerBuild): boolean {
  return CATEGORY_DEFINITIONS.every(([, slug]) => build.slots[slug] !== null)
}

export function filledSlotCount(build: PlayerBuild): number {
  return CATEGORY_DEFINITIONS.filter(([, slug]) => build.slots[slug] !== null).length
}

export function getAvailableCards(cards: Card[], usedCardIds: Set<number>): Card[] {
  return cards.filter((card) => !usedCardIds.has(card.id))
}

export function drawRandomCard(cards: Card[], usedCardIds: Set<number>): Card | null {
  const availableCards = getAvailableCards(cards, usedCardIds)
  if (availableCards.length === 0) return null
  return availableCards[Math.floor(Math.random() * availableCards.length)] ?? null
}

export function placeCard(build: PlayerBuild, category: CategorySlug, card: Card): PlayerBuild {
  if (build.slots[category]) throw new Error('Cette catégorie est déjà remplie.')
  return { ...build, slots: { ...build.slots, [category]: card } }
}

export function getNextPlayerId(playerId: 1 | 2): 1 | 2 {
  return playerId === 1 ? 2 : 1
}

export function resolveManualCombat(winnerId: 1 | 2): ManualCombatResult {
  return { winnerId }
}

export function simulateCombat(_player1Build: PlayerBuild, _player2Build: PlayerBuild): never {
  throw new Error('La simulation automatique sera disponible prochainement.')
}
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

export type PlayerId = 1 | 2 | 3

export type PlayerBuild = {
  playerId: PlayerId
  slots: Record<CategorySlug, Card | null>
}

export type LastPlacement = {
  playerId: PlayerId
  category: CategorySlug
  card: Card
}

export type ManualCombatResult = {
  winnerId: PlayerId
}

function emptySlots(): Record<CategorySlug, Card | null> {
  return Object.fromEntries(CATEGORY_DEFINITIONS.map(([, slug]) => [slug, null])) as Record<CategorySlug, Card | null>
}

export function createPlayerBuild(playerId: PlayerId): PlayerBuild {
  return { playerId, slots: emptySlots() }
}

export function createPlayerBuilds(): [PlayerBuild, PlayerBuild] {
  return [createPlayerBuild(1), createPlayerBuild(2)]
}

export function createPlayerBuildsForCount(playerCount: 2 | 3): PlayerBuild[] {
  return Array.from({ length: playerCount }, (_, index) => createPlayerBuild((index + 1) as PlayerId))
}

export function chooseComputerCategory(build: PlayerBuild): CategorySlug | null {
  return CATEGORY_DEFINITIONS.find(([, slug]) => !build.slots[slug])?.[1] ?? null
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

export function undoPlacement(build: PlayerBuild, placement: LastPlacement): PlayerBuild {
  if (build.playerId !== placement.playerId || build.slots[placement.category]?.id !== placement.card.id) {
    throw new Error('Le dernier placement ne correspond plus à cette composition.')
  }
  return { ...build, slots: { ...build.slots, [placement.category]: null } }
}

export function getNextPlayerId(playerId: PlayerId, playerCount: 2 | 3 = 2): PlayerId {
  return playerId === playerCount ? 1 : ((playerId + 1) as PlayerId)
}

export function resolveManualCombat(winnerId: PlayerId): ManualCombatResult {
  return { winnerId }
}

export function simulateCombat(_player1Build: PlayerBuild, _player2Build: PlayerBuild): never {
  throw new Error('La simulation automatique sera disponible prochainement.')
}
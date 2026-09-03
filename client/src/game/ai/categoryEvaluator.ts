import type { Card } from '../../types/card'
import type { CategorySlug, PlayerBuild } from '../gameEngine'

type Quality = 'weak' | 'correct' | 'good' | 'excellent'
type CategoryProfile = { importance: number; correct: number; good: number; reserveUntil: number; excellent: number }

const categoryValue: Record<CategorySlug, (card: Card) => number> = {
  chakra: (card) => stat(card, 'chakra'),
  invocation: (card) => stat(card, 'invocation'),
  iq: (card) => stat(card, 'iq'),
  ninjutsu: (card) => (stat(card, 'ninjutsuAttack') + stat(card, 'ninjutsuDefense')) / 2,
  genjutsu: (card) => stat(card, 'genjutsu'),
  taijutsu: (card) => stat(card, 'taijutsu'),
  avatar: (card) => stat(card, 'avatar'),
  body: (card) => stat(card, 'body'),
  fuinjutsu: (card) => stat(card, 'fuinjutsu'),
  senjutsu: (card) => stat(card, 'senjutsu'),
  kenjutsu: (card) => stat(card, 'kenjutsu'),
  clan: () => 0,
  vitesse: (card) => stat(card, 'speed'),
  'kekkei-genkai': (card) => stat(card, 'kekkeiGenkai'),
  'kekkei-mora': (card) => stat(card, 'kekkeiMora'),
}

function stat(card: Card, key: string): number {
  if (!card.stats) throw new Error(`Impossible d'évaluer la carte ${card.slug}: statistiques absentes`)
  const value = card.stats[key]
  return typeof value === 'number' ? value : 0
}

// Thresholds are Q1, median, Q3 and P90 of the 163 canonical cards. Sparse categories use their non-zero values.
export const CATEGORY_PROFILES: Record<CategorySlug, CategoryProfile> = {
  chakra: { importance: 1.35, correct: 53.5, good: 63, reserveUntil: 77, excellent: 90.6 },
  invocation: { importance: 0.82, correct: 61.5, good: 75, reserveUntil: 85.5, excellent: 92.2 },
  iq: { importance: 1.35, correct: 67, good: 74, reserveUntil: 82, excellent: 89 },
  ninjutsu: { importance: 1.35, correct: 49.5, good: 62, reserveUntil: 76.25, excellent: 93.4 },
  genjutsu: { importance: 0.82, correct: 70, good: 79, reserveUntil: 90, excellent: 96.2 },
  taijutsu: { importance: 1, correct: 36, good: 43, reserveUntil: 54, excellent: 61 },
  avatar: { importance: 1.35, correct: 73, good: 86, reserveUntil: 94, excellent: 98 },
  body: { importance: 1, correct: 42, good: 52, reserveUntil: 63.5, excellent: 91 },
  fuinjutsu: { importance: 0.82, correct: 74, good: 83.5, reserveUntil: 94, excellent: 96.3 },
  senjutsu: { importance: 1, correct: 94, good: 97, reserveUntil: 99, excellent: 99.8 },
  kenjutsu: { importance: 0.82, correct: 57.5, good: 78, reserveUntil: 88, excellent: 92.6 },
  clan: { importance: 1.35, correct: 0, good: 0, reserveUntil: 0, excellent: 0 },
  vitesse: { importance: 1, correct: 41.5, good: 52, reserveUntil: 66, excellent: 87.6 },
  'kekkei-genkai': { importance: 1, correct: 78.5, good: 88.5, reserveUntil: 95.25, excellent: 99 },
  'kekkei-mora': { importance: 1.35, correct: 0, good: 0, reserveUntil: 0, excellent: 0 },
}

function quality(value: number, profile: CategoryProfile): { level: Quality; score: number } {
  if (value >= profile.excellent) return { level: 'excellent', score: 1 }
  if (value >= profile.reserveUntil) return { level: 'good', score: 0.82 }
  if (value >= profile.good) return { level: 'good', score: 0.6 }
  if (value >= profile.correct) return { level: 'correct', score: 0.35 }
  return { level: 'weak', score: 0 }
}

// Clan et Kekkei Mōra sont évalués uniquement via card.traits (shinobi-card-traits.json), calculé côté serveur
// à partir de clanRules/kekkeiMoraRules. Aucune liste de clans/personnages codée en dur ici.
function clanScore(card: Card): number {
  return card.traits?.clanStrategicScore ?? 0
}

function kekkeiMoraScore(card: Card): number {
  return card.traits?.kekkeiMoraStrategicScore ?? 0
}

function hasAvatarTrait(card: Card): boolean {
  if (!card.traits) return true
  return (card.traits.avatars?.length ?? 0) > 0
}

function strategicScore(build: PlayerBuild, category: CategorySlug, card: Card, openSlots: number): number {
  const profile = CATEGORY_PROFILES[category]
  const value = categoryValue[category](card)
  if (category === 'clan') return clanScore(card)
  if (category === 'kekkei-mora') return kekkeiMoraScore(card)
  if (category === 'avatar' && !hasAvatarTrait(card)) return 0
  const result = quality(value, profile)
  const reservationPenalty = profile.importance > 1.2 && value < profile.reserveUntil && openSlots > 3 ? 0.55 * (openSlots - 3) / 12 : 0
  return result.score * profile.importance - reservationPenalty
}

function effectiveValue(category: CategorySlug, card: Card): number {
  if (category === 'avatar' && !hasAvatarTrait(card)) return 0
  return categoryValue[category](card)
}

export function chooseBestCategory(build: PlayerBuild, card: Card): CategorySlug | null {
  if (!card.stats || !Object.values(card.stats).some((value) => typeof value === 'number')) throw new Error(`Impossible d'évaluer la carte ${card.slug}: statistiques absentes`)
  const available = (Object.keys(categoryValue) as CategorySlug[]).filter((category) => !build.slots[category])
  if (!available.length) return null
  const openSlots = available.length
  return available.sort((left, right) => strategicScore(build, right, card, openSlots) - strategicScore(build, left, card, openSlots) || effectiveValue(right, card) - effectiveValue(left, card) || categoryOrder(left) - categoryOrder(right))[0] ?? null
}

function categoryOrder(category: CategorySlug): number {
  return Object.keys(categoryValue).indexOf(category)
}
import type { Card } from '../../types/card'
import type { CategorySlug, PlayerBuild } from '../gameEngine'

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

export function chooseBestCategory(build: PlayerBuild, card: Card): CategorySlug | null {
  if (!card.stats || !Object.values(card.stats).some((value) => typeof value === 'number')) throw new Error(`Impossible d'évaluer la carte ${card.slug}: statistiques absentes`)
  return (Object.keys(categoryValue) as CategorySlug[])
    .filter((category) => !build.slots[category])
    .sort((left, right) => categoryValue[right](card) - categoryValue[left](card) || categoryOrder(left) - categoryOrder(right))[0] ?? null
}

function categoryOrder(category: CategorySlug): number {
  return Object.keys(categoryValue).indexOf(category)
}
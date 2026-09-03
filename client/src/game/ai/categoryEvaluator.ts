import type { Card } from '../../types/card'
import type { CategorySlug, PlayerBuild } from '../gameEngine'

const categoryValue: Record<CategorySlug, (card: Card) => number> = {
  chakra: (card) => card.stats.chakra ?? 0,
  invocation: (card) => card.stats.invocation ?? 0,
  iq: (card) => card.stats.iq ?? 0,
  ninjutsu: (card) => (card.stats.ninjutsuAttack ?? 0) + (card.stats.ninjutsuDefense ?? 0),
  genjutsu: (card) => card.stats.genjutsu ?? 0,
  taijutsu: (card) => card.stats.taijutsu ?? 0,
  avatar: (card) => card.stats.avatar ?? 0,
  body: (card) => card.stats.body ?? 0,
  fuinjutsu: (card) => card.stats.fuinjutsu ?? 0,
  senjutsu: (card) => card.stats.senjutsu ?? 0,
  kenjutsu: (card) => card.stats.kenjutsu ?? 0,
  clan: () => 0,
  vitesse: (card) => card.stats.speed ?? 0,
  'kekkei-genkai': (card) => card.stats.kekkeiGenkai ?? 0,
  'kekkei-mora': () => 0,
}

export function chooseBestCategory(build: PlayerBuild, card: Card): CategorySlug | null {
  return (Object.keys(categoryValue) as CategorySlug[])
    .filter((category) => !build.slots[category])
    .sort((left, right) => categoryValue[right](card) - categoryValue[left](card) || left.localeCompare(right))[0] ?? null
}
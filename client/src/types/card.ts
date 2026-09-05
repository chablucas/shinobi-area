export type CardTraits = {
  state?: { status: string; implicit: boolean; bodyEffect: string | null; bodyNerfMultiplier: number | null }
  eligibleSlots?: string[]
  dojutsu?: string[]
  avatars?: Array<{ kind: string; id: string }>
  powerUps?: string[]
  abilities?: { kekkeiMora?: string[]; kekkeiGenkai?: string[]; ninjutsu?: string[]; genjutsu?: string[] }
  requirements?: { ninjutsu?: string[]; genjutsu?: string[]; avatar?: string[] }
  ai?: { role?: string; preferredSlots?: string[]; avoidUnlessForced?: string[] }
  clanStrategicScore?: number
  kekkeiMoraStrategicScore?: number
}

export type Card = {
  id: number
  name: string
  slug: string
  imageUrl: string | null
  clans?: string[]
  stats: Record<string, number | null>
  baseStats: Record<string, number>
  effectiveStats: Record<string, number>
  powerIds: string[]
  physicalTraitIds: string[]
  transformationIds: string[]
  avatars: Array<{ id: string; type: string; name: string }>
  traits?: CardTraits | null
  baseRarity: string
  effectiveRarity: string
  rarityMetadata: { id: string; label: string; rank: number; colorName: string; colorHex: string }
  modifiers: CardModifier[]
  hasStatOverrides: boolean
  hasRarityOverride: boolean
  catalog?: {
    powerCatalog: Record<string, { label: string }>
    physicalTraitCatalog: Record<string, { label: string }>
    transformationCatalog: Record<string, { label: string }>
    clanCatalog: string[]
    cardCatalog: Array<{ id: number; slug: string; name: string }>
  }
  relatedRules?: Array<{
    id: string
    name: string
    enabled: boolean
    phase: string
    priority: number
    active: boolean
    conditionsSummary: string
    effectsSummary: string
  }>
}

export type CardModifier = {
  id: number
  name: string
  description: string
  target: string
  categories: string[]
  direction: 'BONUS' | 'MALUS'
  operation: 'PERCENT' | 'POINTS'
  value: number
  condition: string | null
  conditionType: string | null
  conditionValue: string | null
  active: boolean
}

export type Category = {
  slug: string
  label: string
}
import cardsDataJson from '../data/shinobi-cards-data.json' with { type: 'json' }
import classicRulesJson from '../data/rules/classic.json' with { type: 'json' }

export type AvatarData = {
  type: string
  id: string
  name: string
}

export type HealthStatusData = {
  status: string
  implicit: boolean
}

export type TaijutsuProfileData = {
  eightGatesMaximum: number
}

export type CardData = {
  id: number
  slug: string
  name: string
  rarity: string
  rarityScore?: number
  rarityMeta?: { label: string; rank: number; colorName: string; colorHex: string }
  clans: string[]
  stats: Record<string, number>
  signaturePowers: string[]
  powerIds: string[]
  dojutsu: string[]
  avatars: AvatarData[]
  physicalParticularities: string[]
  physicalTraitIds: string[]
  transformations: string[]
  transformationIds: string[]
  healthStatus?: HealthStatusData
  taijutsuProfile?: TaijutsuProfileData
  traits?: Record<string, unknown>
}

export type RuleCondition = {
  side: 'SELF' | 'OPPONENT'
  slot: string
  field: string
  operator: string
  value: unknown
}

export type RuleEffect = {
  side: 'SELF' | 'OPPONENT'
  slot: string
  stat: string
  operation: 'PERCENT_ADD' | 'SET_FINAL' | 'POINT_ADD' | 'DISABLE_POWER' | string
  value: number | null
}

export type CombatRule = {
  id: string
  name: string
  enabled: boolean
  status?: string
  phase: string
  priority: number
  activation: {
    all?: RuleCondition[]
    any?: RuleCondition[]
    none?: RuleCondition[]
    anyFailure?: RuleCondition[]
  }
  effects: RuleEffect[]
  stacking?: {
    mode: string
    group: string
  }
  ai?: {
    considerDuringPlacement?: boolean
    treatAsMajorRisk?: boolean
  }
  notes?: string[]
}

export type ValidationStats = {
  cardsLoaded: number
  rulesLoaded: number
  duplicateSlugs: number
  invalidRulesReferences: number
  invalidPowerIds: number
  invalidPhysicalTraitIds: number
  invalidTransformationIds: number
  invalidAvatarIds: number
}

const rawCardsData = cardsDataJson as unknown as {
  cards: CardData[]
  powerCatalog?: Record<string, unknown>
  physicalTraitCatalog?: Record<string, unknown>
  transformationCatalog?: Record<string, unknown>
}

const rawRulesData = classicRulesJson as unknown as {
  combatRules: CombatRule[]
}

export const cards: CardData[] = rawCardsData.cards ?? []
export const rules: CombatRule[] = rawRulesData.combatRules ?? []
export const powerCatalog = rawCardsData.powerCatalog ?? {}
export const physicalTraitCatalog = rawCardsData.physicalTraitCatalog ?? {}
export const transformationCatalog = rawCardsData.transformationCatalog ?? {}

export const cardsBySlug = new Map<string, CardData>()
export const cardsById = new Map<number, CardData>()

for (const card of cards) {
  if (!card.slug) {
    throw new Error(`Carte sans slug détectée (ID: ${card.id ?? 'inconnu'})`)
  }
  if (cardsBySlug.has(card.slug)) {
    throw new Error(`Slug de carte dupliqué détecté : ${card.slug}`)
  }
  cardsBySlug.set(card.slug, card)
  if (card.id !== undefined) {
    cardsById.set(card.id, card)
  }
}

export function validateGameData(): ValidationStats {
  const stats: ValidationStats = {
    cardsLoaded: cards.length,
    rulesLoaded: rules.length,
    duplicateSlugs: 0,
    invalidRulesReferences: 0,
    invalidPowerIds: 0,
    invalidPhysicalTraitIds: 0,
    invalidTransformationIds: 0,
    invalidAvatarIds: 0,
  }

  if (cards.length !== 163) {
    throw new Error(`Nombre de cartes invalide : ${cards.length} chargées, 163 attendues.`)
  }

  if (rules.length !== 50) {
    throw new Error(`Nombre de règles invalide : ${rules.length} chargées, 50 attendues.`)
  }

  const cardSlugs = new Set(cards.map((c) => c.slug))
  const avatarIds = new Set<string>()
  const avatarTypes = new Set<string>()

  for (const card of cards) {
    for (const avatar of card.avatars ?? []) {
      if (avatar.id) avatarIds.add(avatar.id)
      if (avatar.type) avatarTypes.add(avatar.type)
    }
  }

  const errors: string[] = []

  function checkCondition(ruleId: string, cond: RuleCondition) {
    const { field, value } = cond
    const values = Array.isArray(value) ? value : [value]

    if (field === 'card.slug') {
      for (const v of values) {
        if (typeof v === 'string' && !v.startsWith('self.') && !v.startsWith('opponent.') && !cardSlugs.has(v)) {
          stats.invalidRulesReferences++
          errors.push(`Règle [${ruleId}] : card.slug inconnu "${v}"`)
        }
      }
    } else if (field === 'card.powerIds') {
      for (const v of values) {
        if (typeof v === 'string' && !(v in powerCatalog)) {
          stats.invalidPowerIds++
          stats.invalidRulesReferences++
          errors.push(`Règle [${ruleId}] : powerId inconnu "${v}"`)
        }
      }
    } else if (field === 'card.physicalTraitIds') {
      for (const v of values) {
        if (typeof v === 'string' && !(v in physicalTraitCatalog)) {
          stats.invalidPhysicalTraitIds++
          stats.invalidRulesReferences++
          errors.push(`Règle [${ruleId}] : physicalTraitId inconnu "${v}"`)
        }
      }
    } else if (field === 'card.transformationIds') {
      for (const v of values) {
        if (typeof v === 'string' && !(v in transformationCatalog)) {
          stats.invalidTransformationIds++
          stats.invalidRulesReferences++
          errors.push(`Règle [${ruleId}] : transformationId inconnu "${v}"`)
        }
      }
    } else if (field === 'selectedAvatar.id') {
      for (const v of values) {
        if (typeof v === 'string' && !avatarIds.has(v)) {
          stats.invalidAvatarIds++
          stats.invalidRulesReferences++
          errors.push(`Règle [${ruleId}] : selectedAvatar.id inconnu "${v}"`)
        }
      }
    } else if (field === 'selectedAvatar.type') {
      for (const v of values) {
        if (typeof v === 'string' && !avatarTypes.has(v)) {
          stats.invalidRulesReferences++
          errors.push(`Règle [${ruleId}] : selectedAvatar.type inconnu "${v}"`)
        }
      }
    }
  }

  for (const rule of rules) {
    const act = rule.activation ?? {}
    const conditionGroups = [act.all, act.any, act.none, act.anyFailure]
    for (const group of conditionGroups) {
      if (group) {
        for (const cond of group) {
          checkCondition(rule.id, cond)
        }
      }
    }
  }

  if (errors.length > 0) {
    const message = `Erreurs de validation des règles par rapport aux données :\n${errors.join('\n')}`
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      throw new Error(message)
    } else {
      console.error(message)
    }
  }

  return stats
}

// Validation automatique au chargement
validateGameData()

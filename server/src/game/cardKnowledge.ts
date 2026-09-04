import { catalogRules, getAllCanonicalCards, getCanonicalCard, getCanonicalCardById, getRarityMeta, rarityOrder as canonicalRarityOrder } from './cardCatalog.js'

export type CardStats = Record<string, number>
export type CardTraitAvatar = { kind: string; id: string; conditions: string[]; nerfs: unknown[] }
export type CardTraitAi = { preferredSlots: string[]; avoidUnlessForced: string[]; role: string; notes: string[] }
export type CardTraits = {
  state: { status: string; implicit: boolean; bodyEffect: string | null; bodyNerfMultiplier: number | null }
  eligibleSlots: string[]
  dojutsu: string[]
  avatars: CardTraitAvatar[]
  powerUps: string[]
  abilities: { ninjutsu: string[]; genjutsu: string[]; kekkeiGenkai: string[]; kekkeiMora: string[] }
  requirements: { ninjutsu: string[]; genjutsu: string[]; avatar: string[] }
  separation: { kekkeiGenkaiCountedAsNinjutsu: boolean; kekkeiMoraCountedAsNinjutsu: boolean }
  ai: CardTraitAi
  clanStrategicScore: number
  kekkeiMoraStrategicScore: number
}

export type RarityMetadata = {
  id: string
  label: string
  rank: number
  colorName: string
  colorHex: string
  minScore: number
  maxScore: number
}

export type CardKnowledge = {
  id: number
  slug: string
  name: string
  clans: string[]
  stats: CardStats
  traits: CardTraits
  rarity: string
  rarityScore: number
  rarityMeta: { label: string; rank: number; colorName: string; colorHex: string }
  rarityMetadata: RarityMetadata
}

type ClanRule = { bonuses: Array<{ target: string; percent: number }>; permissions: string[] }
type KekkeiMoraRule = { trigger: { card?: string; cards?: string[]; cardPrefix?: string }; bonuses?: Array<{ target: string; percent: number }> }

type CatalogRuleSet = { clanRules?: Record<string, ClanRule>; kekkeiMoraRules?: Record<string, KekkeiMoraRule> }

const ruleSet = catalogRules as CatalogRuleSet
const clanRules = ruleSet.clanRules ?? {}
const kekkeiMoraRules = ruleSet.kekkeiMoraRules ?? {}

export const rarityOrder = canonicalRarityOrder

function clanStrategicScore(clans: string[]): number {
  return clans.reduce((best, clan) => {
    const rule = clanRules[clan.toUpperCase()]
    if (!rule) return best
    const bonusWeight = (rule.bonuses ?? []).reduce((sum, bonus) => sum + bonus.percent, 0) / 100
    const permissionWeight = (rule.permissions ?? []).length * 0.15
    return Math.max(best, bonusWeight + permissionWeight)
  }, 0)
}

function kekkeiMoraStrategicScore(name: string, abilities: string[]): number {
  if (!abilities.length) return 0
  const bonusWeight = Object.values(kekkeiMoraRules).reduce((sum, rule) => {
    const trigger = rule.trigger ?? {}
    const matches = trigger.card === name || trigger.cards?.includes(name) || (trigger.cardPrefix ? name.startsWith(trigger.cardPrefix) : false)
    if (!matches || !rule.bonuses) return sum
    return sum + rule.bonuses.reduce((total, bonus) => total + bonus.percent, 0) / 100
  }, 0)
  return 1 + bonusWeight
}

function normalizeRarityMetadata(card: { rarity: string; rarityMeta?: { label: string; rank: number; colorName: string; colorHex: string }; rarityScore?: number }): RarityMetadata {
  const base = getRarityMeta(card.rarity) ?? { id: card.rarity, label: card.rarityMeta?.label ?? card.rarity, rank: card.rarityMeta?.rank ?? 0, colorName: card.rarityMeta?.colorName ?? '', colorHex: card.rarityMeta?.colorHex ?? '#000000', minScore: 0, maxScore: 100 }
  return {
    id: base.id,
    label: base.label,
    rank: base.rank,
    colorName: base.colorName,
    colorHex: base.colorHex,
    minScore: base.minScore,
    maxScore: base.maxScore,
  }
}

export const CARD_KNOWLEDGE: CardKnowledge[] = getAllCanonicalCards().map((card) => {
  const traits = card.traits as CardTraits
  const rarityMetadata = normalizeRarityMetadata(card)
  return {
    id: card.id,
    slug: card.slug,
    name: card.name,
    clans: card.clans,
    stats: card.stats as CardStats,
    traits: {
      ...traits,
      clanStrategicScore: clanStrategicScore(card.clans),
      kekkeiMoraStrategicScore: kekkeiMoraStrategicScore(card.name, traits.abilities?.kekkeiMora ?? []),
    },
    rarity: card.rarity,
    rarityScore: card.rarityScore,
    rarityMeta: card.rarityMeta ?? { label: rarityMetadata.label, rank: rarityMetadata.rank, colorName: rarityMetadata.colorName, colorHex: rarityMetadata.colorHex },
    rarityMetadata,
  }
})

export const CARD_KNOWLEDGE_COUNT = CARD_KNOWLEDGE.length

const knowledgeBySlug = new Map(CARD_KNOWLEDGE.map((card) => [card.slug, card]))
const knowledgeById = new Map(CARD_KNOWLEDGE.map((card) => [card.id, card]))

function withLegacyNameFallback(card: CardKnowledge, requestedSlug: string): CardKnowledge {
  const normalizedRequested = requestedSlug.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'et').replace(/[^a-z0-9]+/g, '-')
  const normalizedCardName = card.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'et').replace(/[^a-z0-9]+/g, '-')
  const baseName = card.name.replace(/\s+(Prime|Malade|Orange|Blanc|Vieux)$/i, '')
  const normalizedBaseName = baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'et').replace(/[^a-z0-9]+/g, '-')
  if (normalizedRequested === normalizedCardName || normalizedRequested === normalizedBaseName) {
    return { ...card, name: normalizedRequested === normalizedBaseName ? baseName : card.name }
  }
  return card
}

export function getCardKnowledgeBySlug(slug: string): CardKnowledge | undefined {
  const canonical = getCanonicalCard(slug)
  if (!canonical) return undefined
  const card = knowledgeBySlug.get(canonical.slug) ?? knowledgeBySlug.get(slug)
  return card ? withLegacyNameFallback(card, slug) : undefined
}

export function getCardKnowledgeById(id: number): CardKnowledge | undefined {
  const canonical = getCanonicalCardById(id)
  return knowledgeById.get(id) ?? (canonical ? knowledgeBySlug.get(canonical.slug) : undefined)
}

export function listCardKnowledge(): CardKnowledge[] {
  return [...CARD_KNOWLEDGE]
}

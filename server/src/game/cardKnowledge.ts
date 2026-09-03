import cardStatsData from '../data/shinobi-card-stats.json' with { type: 'json' }
import cardTraitsData from '../data/shinobi-card-traits.json' with { type: 'json' }
import cardRaritiesData from '../data/shinobi-card-rarities.json' with { type: 'json' }

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
  // Poids stratégiques dérivés des règles globales (clanRules / kekkeiMoraRules), pas de liste de personnages/clans codée en dur côté IA.
  clanStrategicScore: number
  kekkeiMoraStrategicScore: number
}

export type RarityMetadata = { id: string; label: string; rank: number; colorName: string; colorHex: string; minScore: number; maxScore: number }
export type CardKnowledge = { id: number; slug: string; name: string; clans: string[]; stats: CardStats; traits: CardTraits; rarity: string; rarityMetadata: RarityMetadata }

type RawStatsCard = { id: number; name: string; slug: string; clans: string[]; stats: CardStats }
type RawTraitsCard = { id: number; name: string; slug: string; clans: string[] } & Omit<CardTraits, 'clanStrategicScore' | 'kekkeiMoraStrategicScore'>
type ClanRule = { bonuses: Array<{ target: string; percent: number }>; permissions: string[] }
type KekkeiMoraRule = { trigger: { card?: string; cards?: string[]; cardPrefix?: string }; bonuses?: Array<{ target: string; percent: number }> }

const statsCards = cardStatsData as RawStatsCard[]
const traitsRoot = cardTraitsData as { cardTraits: RawTraitsCard[]; clanRules: Record<string, ClanRule>; kekkeiMoraRules: Record<string, KekkeiMoraRule> }
const traitsCards = traitsRoot.cardTraits
const clanRules = traitsRoot.clanRules
const kekkeiMoraRules = traitsRoot.kekkeiMoraRules
const rarityRoot = cardRaritiesData as { rarityOrder: RarityMetadata[]; cards?: Array<{ slug: string; rarity: string }> }
export const rarityOrder = rarityRoot.rarityOrder
const rarityBySlug = new Map((rarityRoot.cards ?? []).map((card) => [card.slug, card.rarity]))
const rarityMetadataById = new Map(rarityOrder.map((rarity) => [rarity.id, rarity]))

// Un clan sans bonus ni permission dans clanRules n'obtient aucune valeur stratégique artificielle.
function clanStrategicScore(clans: string[]): number {
  return clans.reduce((best, clan) => {
    const rule = clanRules[clan.toUpperCase()]
    if (!rule) return best
    const bonusWeight = rule.bonuses.reduce((sum, bonus) => sum + bonus.percent, 0) / 100
    const permissionWeight = rule.permissions.length * 0.15
    return Math.max(best, bonusWeight + permissionWeight)
  }, 0)
}

// La compatibilité Kekkei Mōra vient uniquement de abilities.kekkeiMora ; le bonus de combat éventuel (kekkeiMoraRules) affine le poids.
function kekkeiMoraStrategicScore(name: string, abilities: string[]): number {
  if (!abilities.length) return 0
  const bonusWeight = Object.values(kekkeiMoraRules).reduce((sum, rule) => {
    const matches = rule.trigger.card === name || rule.trigger.cards?.includes(name) || (rule.trigger.cardPrefix ? name.startsWith(rule.trigger.cardPrefix) : false)
    if (!matches || !rule.bonuses) return sum
    return sum + rule.bonuses.reduce((total, bonus) => total + bonus.percent, 0) / 100
  }, 0)
  return 1 + bonusWeight
}

function assertConsistency() {
  const statsSlugs = statsCards.map((card) => card.slug)
  const traitsSlugs = traitsCards.map((card) => card.slug)
  const statsSlugSet = new Set(statsSlugs)
  const traitsSlugSet = new Set(traitsSlugs)
  const rarityCards = rarityRoot.cards ?? []
  const raritySlugs = rarityCards.map((card) => card.slug)
  const raritySlugSet = new Set(raritySlugs)
  if (statsSlugs.length !== statsSlugSet.size) throw new Error('shinobi-card-stats.json contient des slugs en double.')
  if (traitsSlugs.length !== traitsSlugSet.size) throw new Error('shinobi-card-traits.json contient des slugs en double.')
  if (raritySlugs.length !== raritySlugSet.size) throw new Error('shinobi-card-rarities.json contient des slugs en double.')
  if (statsSlugs.length !== 163 || traitsSlugs.length !== 163 || raritySlugs.length !== 163) throw new Error('Les trois sources canoniques doivent contenir 163 cartes.')
  const missingInTraits = statsSlugs.filter((slug) => !traitsSlugSet.has(slug))
  const missingInStats = traitsSlugs.filter((slug) => !statsSlugSet.has(slug))
  if (missingInTraits.length || missingInStats.length) {
    throw new Error(`Incohérence entre shinobi-card-stats.json et shinobi-card-traits.json (manquants côté traits: ${missingInTraits.join(', ') || 'aucun'}; manquants côté stats: ${missingInStats.join(', ') || 'aucun'}).`)
  }
  const missingInRarities = statsSlugs.filter((slug) => !raritySlugSet.has(slug))
  const unknownRarities = raritySlugs.filter((slug) => !statsSlugSet.has(slug))
  if (missingInRarities.length || unknownRarities.length) throw new Error(`Incohérence de rareté (manquants: ${missingInRarities.join(', ') || 'aucun'}; inconnus: ${unknownRarities.join(', ') || 'aucun'}).`)
}

assertConsistency()

const traitsBySlug = new Map(traitsCards.map((card) => [card.slug, card]))

export const CARD_KNOWLEDGE: CardKnowledge[] = statsCards.map((statsCard) => {
  const traitsCard = traitsBySlug.get(statsCard.slug)
  if (!traitsCard) throw new Error(`Traits introuvables pour la carte ${statsCard.slug}.`)
  const { id, name, slug, clans, ...traits } = traitsCard
  const rarity = rarityBySlug.get(statsCard.slug)
  const rarityMetadata = rarity ? rarityMetadataById.get(rarity) : undefined
  if (!rarity || !rarityMetadata) throw new Error(`Rareté introuvable pour la carte ${statsCard.slug}.`)
  return {
    id: statsCard.id,
    slug: statsCard.slug,
    name: statsCard.name,
    clans: statsCard.clans,
    stats: statsCard.stats,
    traits: {
      ...traits,
      clanStrategicScore: clanStrategicScore(statsCard.clans),
      kekkeiMoraStrategicScore: kekkeiMoraStrategicScore(name, traits.abilities.kekkeiMora),
    },
    rarity,
    rarityMetadata,
  }
})

export const CARD_KNOWLEDGE_COUNT = CARD_KNOWLEDGE.length

const knowledgeBySlug = new Map(CARD_KNOWLEDGE.map((card) => [card.slug, card]))
const knowledgeById = new Map(CARD_KNOWLEDGE.map((card) => [card.id, card]))

export function getCardKnowledgeBySlug(slug: string): CardKnowledge | undefined {
  return knowledgeBySlug.get(slug)
}

export function getCardKnowledgeById(id: number): CardKnowledge | undefined {
  return knowledgeById.get(id)
}

export function listCardKnowledge(): CardKnowledge[] {
  return CARD_KNOWLEDGE
}

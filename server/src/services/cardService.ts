import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import cardsDataJson from '../data/shinobi-cards-data.json' with { type: 'json' }
import { rules as combatRules } from './gameDataService.js'
import { getCardKnowledgeBySlug, rarityOrder } from '../game/cardKnowledge.js'
import { resolveCanonicalSlug } from '../game/cardCatalog.js'

const cardInclude = { stats: { include: { category: true }, orderBy: { category: { position: 'asc' as const } } } }
type CardWithStats = Prisma.CardGetPayload<{ include: { stats: { include: { category: true } } } }>

const typedCardsData = cardsDataJson as {
  cards?: Array<{ id: number; slug: string; name: string; clans?: string[] }>
  powerCatalog?: Record<string, { label?: string }>
  physicalTraitCatalog?: Record<string, { label?: string }>
  transformationCatalog?: Record<string, { label?: string }>
}

function catalogLabelMap(raw: Record<string, { label?: string }> | undefined) {
  return Object.fromEntries(Object.entries(raw ?? {}).map(([key, value]) => [key, { label: value?.label ?? key }]))
}

function summarizeRuleCondition(condition: { field?: string; value?: unknown }): string {
  if (!condition.field) return 'Condition'
  const values = Array.isArray(condition.value) ? condition.value : [condition.value]
  const strings = values.filter((value): value is string => typeof value === 'string')
  return `${condition.field} ${strings.join(', ') || 'inconnu'}`
}

function summarizeRuleEffects(effects: Array<{ stat?: string; slot?: string; operation?: string; value?: number | null }> = []) {
  return effects.map((effect) => `${effect.stat ?? effect.slot ?? 'effet'} ${effect.operation ?? 'MODIFIER'} ${effect.value ?? 0}`).join(' · ') || 'Aucun effet'
}

type CardDto = {
  id: number
  name: string
  slug: string
  imageUrl: string | null
  clans: string[]
  baseStats: Record<string, number>
  effectiveStats: Record<string, number>
  stats: Record<string, number>
  powerIds: string[]
  physicalTraitIds: string[]
  transformationIds: string[]
  avatars: Array<{ id: string; type: string; name: string }>
  traits: unknown
  baseRarity: string
  effectiveRarity: string
  rarityMetadata: {
    id: string
    label: string
    rank: number
    colorName: string
    colorHex: string
    minScore: number
    maxScore: number
  }
  modifiers: unknown[]
  hasStatOverrides: boolean
  hasRarityOverride: boolean
  catalog: {
    powerCatalog: Record<string, { label: string }>
    physicalTraitCatalog: Record<string, { label: string }>
    transformationCatalog: Record<string, { label: string }>
    clanCatalog: string[]
    cardCatalog: Array<{ id: number; slug: string; name: string }>
  }
  relatedRules: Array<{
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

export function serializeCard(card: CardWithStats | null): CardDto | null {
  if (!card) return null
  const canonicalSlug = resolveCanonicalSlug(card.slug)
  const knowledge = getCardKnowledgeBySlug(canonicalSlug)
  if (!knowledge) {
    throw new Error(`Carte canonique absente pour le slug Prisma ${card.slug}.`)
  }

  const matchingRules = combatRules.filter((rule) => {
    const groups = [rule.activation?.all ?? [], rule.activation?.any ?? [], rule.activation?.none ?? [], rule.activation?.anyFailure ?? []]
    return groups.some((group) => group.some((condition) => {
      const field = condition.field
      const values = Array.isArray(condition.value) ? condition.value : [condition.value]
      const normalizedValues = values.filter((value): value is string => typeof value === 'string')
      if (!normalizedValues.length) return false
      if (field === 'card.slug') return normalizedValues.includes(canonicalSlug) || normalizedValues.includes(card.slug)
      if (field === 'card.clans') return knowledge.clans.some((clan) => normalizedValues.includes(clan))
      if (field === 'card.powerIds') return knowledge.powerIds.some((powerId) => normalizedValues.includes(powerId))
      if (field === 'card.physicalTraitIds') return knowledge.physicalTraitIds.some((traitId) => normalizedValues.includes(traitId))
      if (field === 'card.transformationIds') return knowledge.transformationIds.some((transformationId) => normalizedValues.includes(transformationId))
      if (field === 'selectedAvatar.id') return (knowledge.avatars ?? []).some((avatar) => normalizedValues.includes(avatar.id))
      if (field === 'selectedAvatar.type') return (knowledge.avatars ?? []).some((avatar) => normalizedValues.includes(avatar.type))
      return false
    }))
  }).map((rule) => ({
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled !== false,
    phase: rule.phase,
    priority: rule.priority ?? 0,
    active: rule.enabled !== false,
    conditionsSummary: [
      ...(rule.activation?.all ?? []).map((condition) => summarizeRuleCondition(condition)),
      ...(rule.activation?.any ?? []).map((condition) => summarizeRuleCondition(condition)),
      ...(rule.activation?.none ?? []).map((condition) => summarizeRuleCondition(condition)),
      ...(rule.activation?.anyFailure ?? []).map((condition) => summarizeRuleCondition(condition)),
    ].join(' · ') || 'Toujours actif',
    effectsSummary: summarizeRuleEffects(rule.effects ?? []),
  }))

  return {
    id: card.id,
    name: knowledge.name,
    slug: canonicalSlug,
    imageUrl: card.imageUrl,
    clans: knowledge.clans,
    baseStats: knowledge.stats,
    effectiveStats: knowledge.stats,
    stats: knowledge.stats,
    powerIds: knowledge.powerIds,
    physicalTraitIds: knowledge.physicalTraitIds,
    transformationIds: knowledge.transformationIds,
    avatars: knowledge.avatars,
    traits: knowledge.traits,
    baseRarity: knowledge.rarity,
    effectiveRarity: knowledge.rarity,
    rarityMetadata: knowledge.rarityMetadata,
    modifiers: [],
    hasStatOverrides: false,
    hasRarityOverride: false,
    catalog: {
      powerCatalog: catalogLabelMap(typedCardsData.powerCatalog),
      physicalTraitCatalog: catalogLabelMap(typedCardsData.physicalTraitCatalog),
      transformationCatalog: catalogLabelMap(typedCardsData.transformationCatalog),
      clanCatalog: Array.from(new Set((typedCardsData.cards ?? []).flatMap((entry) => entry.clans ?? []))).sort(),
      cardCatalog: (typedCardsData.cards ?? []).map((entry) => ({ id: entry.id, slug: entry.slug, name: entry.name })),
    },
    relatedRules: matchingRules,
  }
}

export async function listCards(page: number, limit: number) {
  const [cards, total] = await Promise.all([
    prisma.card.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' }, include: cardInclude }),
    prisma.card.count(),
  ])
  const data = await Promise.all(cards.map((card) => getEffectiveCard(card.slug, card)))
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
}

export async function getCard(idOrSlug: string) {
  const id = Number(idOrSlug)
  const canonicalSlug = resolveCanonicalSlug(idOrSlug)
  const card = await prisma.card.findFirst({ where: Number.isInteger(id) && id > 0 ? { OR: [{ id }, { slug: idOrSlug }, { slug: canonicalSlug }] } : { OR: [{ slug: idOrSlug }, { slug: canonicalSlug }] }, include: cardInclude })
  return card ? getEffectiveCard(card.slug, card) : null
}

export async function getEffectiveCard(slug: string, card?: CardWithStats | null) {
  const canonicalSlug = resolveCanonicalSlug(slug)
  const source = card ?? await prisma.card.findFirst({ where: { OR: [{ slug }, { slug: canonicalSlug }] }, include: cardInclude })
  const serialized = serializeCard(source)
  if (!serialized) return null
  const [statOverrides, rarityOverride, modifiers] = await Promise.all([
    prisma.cardStatOverride.findMany({ where: { cardSlug: canonicalSlug } }),
    prisma.cardRarityOverride.findUnique({ where: { cardSlug: canonicalSlug } }),
    prisma.cardModifier.findMany({ where: { cardSlug: canonicalSlug }, orderBy: { createdAt: 'asc' } }),
  ])
  const effectiveStats = { ...serialized.baseStats }
  for (const override of statOverrides) effectiveStats[override.statKey] = override.value
  const effectiveRarity = rarityOverride?.rarity ?? serialized.baseRarity
  const metadata = rarityOrder.find((rarity) => rarity.id === effectiveRarity) ?? serialized.rarityMetadata
  return { ...serialized, effectiveStats, stats: effectiveStats, effectiveRarity, rarityMetadata: metadata, modifiers, hasStatOverrides: statOverrides.length > 0, hasRarityOverride: !!rarityOverride }
}
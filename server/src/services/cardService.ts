import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { getCardKnowledgeBySlug, rarityOrder } from '../game/cardKnowledge.js'
import { resolveCanonicalSlug } from '../game/cardCatalog.js'

const cardInclude = { stats: { include: { category: true }, orderBy: { category: { position: 'asc' as const } } } }
type CardWithStats = Prisma.CardGetPayload<{ include: { stats: { include: { category: true } } } }>

type CardDto = {
  id: number
  name: string
  slug: string
  imageUrl: string | null
  clans: string[]
  baseStats: Record<string, number>
  effectiveStats: Record<string, number>
  stats: Record<string, number>
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
}

export function serializeCard(card: CardWithStats | null): CardDto | null {
  if (!card) return null
  const canonicalSlug = resolveCanonicalSlug(card.slug)
  const knowledge = getCardKnowledgeBySlug(canonicalSlug)
  if (!knowledge) {
    throw new Error(`Carte canonique absente pour le slug Prisma ${card.slug}.`)
  }
  return {
    id: card.id,
    name: knowledge.name,
    slug: canonicalSlug,
    imageUrl: card.imageUrl,
    clans: knowledge.clans,
    baseStats: knowledge.stats,
    effectiveStats: knowledge.stats,
    stats: knowledge.stats,
    traits: knowledge.traits,
    baseRarity: knowledge.rarity,
    effectiveRarity: knowledge.rarity,
    rarityMetadata: knowledge.rarityMetadata,
    modifiers: [],
    hasStatOverrides: false,
    hasRarityOverride: false,
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
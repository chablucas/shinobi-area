import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { listCardKnowledge, getCardKnowledgeBySlug, rarityOrder } from '../game/cardKnowledge.js'

const cardInclude = { stats: { include: { category: true }, orderBy: { category: { position: 'asc' as const } } } }
type CardWithStats = Prisma.CardGetPayload<{ include: { stats: { include: { category: true } } } }>
const knowledgeBySlug = new Map(listCardKnowledge().map((card) => [card.slug, card]))
const knowledgeByName = new Map(listCardKnowledge().map((card) => [normalizeCardName(card.name), card]))

function normalizeCardName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
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
  traits: unknown
  baseRarity: string
  effectiveRarity: string
  rarityMetadata: ReturnType<typeof listCardKnowledge>[number]['rarityMetadata']
  modifiers: unknown[]
  hasStatOverrides: boolean
  hasRarityOverride: boolean
}

export function serializeCard(card: CardWithStats | null): CardDto | null {
  if (!card) return null
  const { stats, ...details } = card
  const knowledge = getCardKnowledgeBySlug(card.slug) ?? knowledgeBySlug.get(card.slug) ?? knowledgeByName.get(normalizeCardName(card.name))
  if (!knowledge) {
    console.warn(`Statistiques canoniques absentes pour la carte ${card.slug}.`)
    return { ...details, imageUrl: card.imageUrl, clans: [], baseStats: {}, effectiveStats: {}, stats: {}, traits: null, baseRarity: 'UNCOMMON', effectiveRarity: 'UNCOMMON', rarityMetadata: rarityOrder[0], modifiers: [], hasStatOverrides: false, hasRarityOverride: false }
  }
  return {
    ...details,
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
  const card = await prisma.card.findFirst({ where: Number.isInteger(id) && id > 0 ? { OR: [{ id }, { slug: idOrSlug }] } : { slug: idOrSlug }, include: cardInclude })
  return card ? getEffectiveCard(card.slug, card) : null
}

export async function getEffectiveCard(slug: string, card?: CardWithStats | null) {
  const source = card ?? await prisma.card.findUnique({ where: { slug }, include: cardInclude })
  const serialized = serializeCard(source)
  if (!serialized) return null
  const [statOverrides, rarityOverride, modifiers] = await Promise.all([
    prisma.cardStatOverride.findMany({ where: { cardSlug: slug } }),
    prisma.cardRarityOverride.findUnique({ where: { cardSlug: slug } }),
    prisma.cardModifier.findMany({ where: { cardSlug: slug }, orderBy: { createdAt: 'asc' } }),
  ])
  const effectiveStats = { ...serialized.baseStats }
  for (const override of statOverrides) effectiveStats[override.statKey] = override.value
  const effectiveRarity = rarityOverride?.rarity ?? serialized.baseRarity
  const metadata = rarityOrder.find((rarity) => rarity.id === effectiveRarity) ?? serialized.rarityMetadata
  return { ...serialized, effectiveStats, stats: effectiveStats, effectiveRarity, rarityMetadata: metadata, modifiers, hasStatOverrides: statOverrides.length > 0, hasRarityOverride: !!rarityOverride }
}
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import cardStatsData from '../data/shinobi-card-stats.json' with { type: 'json' }

const cardInclude = { stats: { include: { category: true }, orderBy: { category: { position: 'asc' as const } } } }
type CardWithStats = Prisma.CardGetPayload<{ include: { stats: { include: { category: true } } } }>
const canonicalStats = new Map(cardStatsData.map((card) => [card.slug, card.stats]))
const canonicalStatsByName = new Map(cardStatsData.map((card) => [normalizeCardName(card.name), card.stats]))

function normalizeCardName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export function serializeCard(card: CardWithStats | null) {
  if (!card) return null
  const { stats, ...details } = card
  const sourceStats = canonicalStats.get(card.slug) ?? canonicalStatsByName.get(normalizeCardName(card.name))
  if (!sourceStats) {
    console.warn(`Statistiques canoniques absentes pour la carte ${card.slug}.`)
    return { ...details, imageUrl: card.imageUrl, stats: {} }
  }
  return {
    ...details,
    imageUrl: card.imageUrl,
    stats: sourceStats,
  }
}

export async function listCards(page: number, limit: number) {
  const [cards, total] = await Promise.all([
    prisma.card.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' }, include: cardInclude }),
    prisma.card.count(),
  ])
  return { data: cards.map((card) => serializeCard(card)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
}

export async function getCard(idOrSlug: string) {
  const id = Number(idOrSlug)
  const card = await prisma.card.findFirst({ where: Number.isInteger(id) && id > 0 ? { OR: [{ id }, { slug: idOrSlug }] } : { slug: idOrSlug }, include: cardInclude })
  return serializeCard(card)
}
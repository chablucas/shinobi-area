import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'

const cardInclude = { stats: { include: { category: true }, orderBy: { category: { position: 'asc' as const } } } }
type CardWithStats = Prisma.CardGetPayload<{ include: { stats: { include: { category: true } } } }>

function serializeCard(card: CardWithStats | null) {
  if (!card) return null
  const { stats, ...details } = card
  return {
    ...details,
    imageUrl: card.imageUrl,
    stats: Object.fromEntries(stats.map(({ category, value }) => [category.slug, value])),
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
import { prisma } from '../config/prisma.js'
import { serializeCard } from './cardService.js'

export async function globalSearch(userId: number, query: string) {
  const term = query.trim()
  if (!term) return { players: [], shinobis: [] }
  const [players, cards] = await Promise.all([
    prisma.user.findMany({ where: { id: { not: userId }, displayName: { contains: term, mode: 'insensitive' } }, select: { id: true, displayName: true }, orderBy: { displayName: 'asc' }, take: 10 }),
    prisma.card.findMany({ where: { name: { contains: term, mode: 'insensitive' } }, orderBy: { name: 'asc' }, take: 10, include: { stats: { include: { category: true } } } }),
  ])
  return { players: players.map((player) => ({ ...player, avatarUrl: null })), shinobis: cards.map((card) => { const result = serializeCard(card); return { id: result?.id, name: result?.name, slug: result?.slug, imageUrl: result?.imageUrl } }) }
}
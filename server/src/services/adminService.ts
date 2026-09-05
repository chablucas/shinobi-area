import { prisma } from '../config/prisma.js'
import { getCardKnowledgeBySlug } from '../game/cardKnowledge.js'

export async function promoteAdminByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user) {
    return { promoted: false, email: normalizedEmail, reason: 'USER_NOT_FOUND' as const }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' },
    select: { id: true, email: true, displayName: true, role: true },
  })

  return { promoted: true, email: normalizedEmail, user: updatedUser }
}

export async function getAdminOverview() {
  const [usersCount, cards] = await Promise.all([
    prisma.user.count(),
    prisma.card.findMany({ select: { slug: true, name: true } }),
  ])

  const rarityBreakdown = new Map<string, number>()

  for (const card of cards) {
    const knowledge = getCardKnowledgeBySlug(card.slug)
    const rarity = knowledge?.rarity ?? 'inconnu'
    rarityBreakdown.set(rarity, (rarityBreakdown.get(rarity) ?? 0) + 1)
  }

  return {
    totalCards: cards.length,
    totalUsers: usersCount,
    rarityBreakdown: Array.from(rarityBreakdown.entries()).map(([rarity, count]) => ({ rarity, count })).sort((left, right) => left.rarity.localeCompare(right.rarity)),
  }
}

export async function listAdminCards(search: string, rarity: string | null) {
  const normalizedSearch = search.trim().toLowerCase()
  const cards = await prisma.card.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, slug: true, name: true, imageUrl: true },
  })

  return cards
    .map((card) => {
      const knowledge = getCardKnowledgeBySlug(card.slug)
      const cardRarity = knowledge?.rarity ?? 'inconnu'
      return { ...card, rarity: cardRarity }
    })
    .filter((card) => {
      const matchesSearch = !normalizedSearch || card.name.toLowerCase().includes(normalizedSearch) || card.slug.toLowerCase().includes(normalizedSearch)
      const matchesRarity = !rarity || card.rarity === rarity
      return matchesSearch && matchesRarity
    })
}

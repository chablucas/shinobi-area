import { prisma } from '../config/prisma.js'
import { CATEGORY_DEFINITIONS } from '../utils/categories.js'

const REQUIRED_SLOT_COUNT = 15

type BuildSlotInput = { categorySlug: string; cardId: number }

function validateSlots(slots: unknown): BuildSlotInput[] {
  if (!Array.isArray(slots) || slots.length !== REQUIRED_SLOT_COUNT) throw Object.assign(new Error('Une composition doit contenir exactement 15 slots.'), { statusCode: 400 })
  const normalized = slots.map((slot) => ({ categorySlug: (slot as BuildSlotInput)?.categorySlug, cardId: (slot as BuildSlotInput)?.cardId }))
  if (normalized.some((slot) => typeof slot.categorySlug !== 'string' || !slot.categorySlug || !Number.isInteger(slot.cardId))) {
    throw Object.assign(new Error('Chaque slot doit contenir une catégorie et une carte valides.'), { statusCode: 400 })
  }
  if (new Set(normalized.map((slot) => slot.categorySlug)).size !== REQUIRED_SLOT_COUNT) throw Object.assign(new Error('Les catégories doivent être uniques.'), { statusCode: 400 })
  const allowedCategories = new Set(CATEGORY_DEFINITIONS.map(([, slug]) => slug))
  if (normalized.some((slot) => !allowedCategories.has(slot.categorySlug as typeof CATEGORY_DEFINITIONS[number][1]))) throw Object.assign(new Error('Catégorie inconnue.'), { statusCode: 400 })
  return normalized
}

export async function listBuilds(userId: number) {
  return prisma.savedBuild.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { slots: { include: { card: true }, orderBy: { id: 'asc' } } } })
}

export async function getBuild(userId: number, id: number) {
  const build = await prisma.savedBuild.findFirst({ where: { id, userId }, include: { slots: { include: { card: true }, orderBy: { id: 'asc' } } } })
  if (!build) throw Object.assign(new Error('Composition introuvable.'), { statusCode: 404 })
  return build
}

export async function createBuild(userId: number, name: string, slots: unknown) {
  const validSlots = validateSlots(slots)
  const cards = await prisma.card.findMany({ where: { id: { in: validSlots.map((slot) => slot.cardId) } }, select: { id: true } })
  if (cards.length !== REQUIRED_SLOT_COUNT) throw Object.assign(new Error('Une ou plusieurs cartes sont introuvables.'), { statusCode: 400 })
  return prisma.savedBuild.create({ data: { userId, name: name.trim() || 'Composition', slots: { create: validSlots } }, include: { slots: { include: { card: true }, orderBy: { id: 'asc' } } } })
}

export async function deleteBuild(userId: number, id: number) {
  const build = await prisma.savedBuild.findFirst({ where: { id, userId }, select: { id: true } })
  if (!build) throw Object.assign(new Error('Composition introuvable.'), { statusCode: 404 })
  await prisma.savedBuild.delete({ where: { id: build.id } })
}

import { CardModifierDirection, CardModifierOperation, CardModifierTarget } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { getEffectiveCard } from './cardService.js'
import { getCardKnowledgeBySlug, rarityOrder } from '../game/cardKnowledge.js'

const statKeys = ['chakra', 'invocation', 'iq', 'ninjutsuAttack', 'ninjutsuDefense', 'genjutsu', 'taijutsu', 'avatar', 'body', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'speed', 'kekkeiGenkai'] as const
const allowedTargets = new Set<string>(Object.values(CardModifierTarget))
function assertCard(slug: string) { if (!getCardKnowledgeBySlug(slug)) throw Object.assign(new Error('Carte inconnue.'), { statusCode: 404 }) }
function assertValue(statKey: string, value: unknown) { if (!statKeys.includes(statKey as typeof statKeys[number]) || !Number.isInteger(value) || Number(value) < 0 || Number(value) > 100) throw Object.assign(new Error('Statistique ou valeur invalide.'), { statusCode: 400 }) }
function assertModifier(input: Record<string, unknown>) {
  const target = typeof input.target === 'string' ? input.target : ''
  const direction = input.direction
  const operation = input.operation
  const value = Number(input.value)
  const categories = Array.isArray(input.categories) ? input.categories.filter((item): item is string => typeof item === 'string') : []

  if (typeof input.name !== 'string' || !input.name.trim() || typeof input.description !== 'string') throw Object.assign(new Error('Nom et description requis.'), { statusCode: 400 })
  if (!target || !allowedTargets.has(target) || !Object.values(CardModifierDirection).includes(direction as CardModifierDirection) || !Object.values(CardModifierOperation).includes(operation as CardModifierOperation) || !Number.isInteger(value) || Number(value) < -100 || Number(value) > 100) throw Object.assign(new Error('Modificateur invalide.'), { statusCode: 400 })
  if (categories.length > 0 && !categories.every((category) => typeof category === 'string' && category.trim())) throw Object.assign(new Error('Catégories invalides.'), { statusCode: 400 })
}
export async function updateStat(slug: string, statKey: string, value: unknown) { assertCard(slug); assertValue(statKey, value); return prisma.cardStatOverride.upsert({ where: { cardSlug_statKey: { cardSlug: slug, statKey } }, create: { cardSlug: slug, statKey, value: Number(value) }, update: { value: Number(value) } }) }
export async function deleteStat(slug: string, statKey: string) { await prisma.cardStatOverride.deleteMany({ where: { cardSlug: slug, statKey } }) }
export async function updateRarity(slug: string, rarity: unknown) { assertCard(slug); if (!rarityOrder.some((item) => item.id === rarity)) throw Object.assign(new Error('Rareté invalide.'), { statusCode: 400 }); return prisma.cardRarityOverride.upsert({ where: { cardSlug: slug }, create: { cardSlug: slug, rarity: String(rarity) }, update: { rarity: String(rarity) } }) }
export async function deleteRarity(slug: string) { await prisma.cardRarityOverride.deleteMany({ where: { cardSlug: slug } }) }
export async function createModifier(slug: string, input: Record<string, unknown>) { assertCard(slug); assertModifier(input); return prisma.cardModifier.create({ data: { cardSlug: slug, name: input.name as string, description: input.description as string, target: input.target as CardModifierTarget, categories: Array.isArray(input.categories) ? input.categories.map((category) => String(category)) : [], direction: input.direction as CardModifierDirection, operation: input.operation as CardModifierOperation, value: Number(input.value), condition: typeof input.condition === 'string' ? input.condition : null, conditionType: typeof input.conditionType === 'string' ? input.conditionType : null, conditionValue: typeof input.conditionValue === 'string' ? input.conditionValue : null, active: input.active !== false } }) }
export async function updateModifier(id: number, input: Record<string, unknown>) { assertModifier(input); return prisma.cardModifier.update({ where: { id }, data: { name: input.name as string, description: input.description as string, target: input.target as CardModifierTarget, categories: Array.isArray(input.categories) ? input.categories.map((category) => String(category)) : [], direction: input.direction as CardModifierDirection, operation: input.operation as CardModifierOperation, value: Number(input.value), condition: typeof input.condition === 'string' ? input.condition : null, conditionType: typeof input.conditionType === 'string' ? input.conditionType : null, conditionValue: typeof input.conditionValue === 'string' ? input.conditionValue : null, active: input.active !== false } }) }
export async function deleteModifier(id: number) { await prisma.cardModifier.delete({ where: { id } }) }
export { getEffectiveCard }
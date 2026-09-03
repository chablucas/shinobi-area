import { prisma } from '../config/prisma.js'
import { CATEGORY_DEFINITIONS } from '../utils/categories.js'

for (const [position, [name, slug]] of CATEGORY_DEFINITIONS.entries()) {
  await prisma.category.upsert({ where: { slug }, update: { name, position: position + 1 }, create: { name, slug, position: position + 1 } })
}
await prisma.category.deleteMany({ where: { slug: 'sensoriel' } })
console.log(`Catégories initialisées : ${CATEGORY_DEFINITIONS.length}`)
await prisma.$disconnect()
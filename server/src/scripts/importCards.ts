import { prisma } from '../config/prisma.js'
import { readCloudinaryZipImages, validateCloudinaryImageUrls } from '../services/cloudinaryImageService.js'
import { CATEGORY_DEFINITIONS } from '../utils/categories.js'
import { EXPECTED_CARD_COUNT, findDuplicates, matchCloudinaryImages, scanCardAssets } from '../utils/cards.js'

const assets = await scanCardAssets()
if (assets.length !== EXPECTED_CARD_COUNT || findDuplicates(assets, 'name').length || findDuplicates(assets, 'slug').length) {
  throw new Error(`Import annulé : corpus invalide (${assets.length}/${EXPECTED_CARD_COUNT}, doublons éventuels).`)
}
let cloudinaryImages
try {
  cloudinaryImages = await readCloudinaryZipImages()
} catch {
  throw new Error('Import annulé : impossible de lire les ressources Cloudinary avec la configuration actuelle.')
}
const categories = await prisma.category.findMany({ select: { id: true, slug: true } })
if (categories.length !== CATEGORY_DEFINITIONS.length) throw new Error('Les catégories doivent être initialisées avant l’import.')
const cards = assets.map((asset) => ({ filePath: asset.filePath, fileName: asset.fileName, name: asset.name, slug: asset.slug }))
const matching = matchCloudinaryImages(cloudinaryImages, cards)
const invalidDeliveryUrls = await validateCloudinaryImageUrls(cloudinaryImages)
if (cloudinaryImages.length !== EXPECTED_CARD_COUNT || matching.matches.length !== EXPECTED_CARD_COUNT || matching.ambiguous.length || matching.unmatchedImages.length || matching.unmatchedCards.length || matching.duplicateImages.length || matching.duplicateCards.length || invalidDeliveryUrls.length) {
  throw new Error(`Import annulé : correspondances Cloudinary invalides (${matching.matches.length}/${EXPECTED_CARD_COUNT}, ambiguës: ${matching.ambiguous.length}, images sans carte: ${matching.unmatchedImages.length}, cartes sans image: ${matching.unmatchedCards.length}).`)
}
const imagesBySlug = new Map(matching.matches.map((match) => [match.card.slug, match.image]))

let imported = 0
let skipped = 0
let updated = 0
let errors = 0
for (const asset of assets) {
  try {
    const image = imagesBySlug.get(asset.slug)
    if (!image) throw new Error('Image Cloudinary introuvable')
    const { publicId, secureUrl: imageUrl } = image
    const existingCard = await prisma.card.findUnique({ where: { slug: asset.slug }, select: { id: true } })
    await prisma.card.upsert({ where: { slug: asset.slug }, update: { name: asset.name, imageUrl, cloudinaryPublicId: publicId }, create: { name: asset.name, slug: asset.slug, imageUrl, cloudinaryPublicId: publicId } })
    const card = await prisma.card.findUniqueOrThrow({ where: { slug: asset.slug }, select: { id: true } })
    await prisma.cardStat.createMany({ data: categories.map(({ id: categoryId }) => ({ cardId: card.id, categoryId, value: null })), skipDuplicates: true })
    if (existingCard) updated++
    else imported++
  } catch (error) {
    errors++
    console.error(`Erreur pour ${asset.fileName}:`, error)
  }
}
console.log(`Importées : ${imported}`)
console.log(`Ignorées : ${skipped}`)
console.log(`Mises à jour : ${updated}`)
console.log(`Erreurs : ${errors}`)
await prisma.$disconnect()
if (errors) process.exitCode = 1
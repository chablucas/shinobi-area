import { prisma } from '../config/prisma.js'
import { readCloudinaryZipImages, validateCloudinaryImageUrls } from '../services/cloudinaryImageService.js'
import { cloudinaryNameForCard, normalizeComparison, EXPECTED_CARD_COUNT, findDuplicates, matchCloudinaryImages, scanCardAssets } from '../utils/cards.js'

const assets = await scanCardAssets()
const cards = assets.map((asset) => ({ name: asset.name, slug: asset.slug }))
let cloudinaryImages
try {
  cloudinaryImages = await readCloudinaryZipImages()
} catch (error) {
  throw new Error(`Contrôle annulé : ${error instanceof Error ? error.message : 'impossible de lire les ressources Cloudinary.'}`)
}

const matching = matchCloudinaryImages(cloudinaryImages, cards.map((card) => ({ filePath: '', fileName: card.name, name: card.name, slug: card.slug })))
const invalidDeliveryUrls = await validateCloudinaryImageUrls(cloudinaryImages)

console.log(JSON.stringify({
  localImages: assets.length,
  cards: cards.length,
  cloudinaryZipFiles: cloudinaryImages.length,
  exactMatches: matching.matches.filter(({ method }) => method === 'exact').length,
  slugMatches: matching.matches.filter(({ method }) => method === 'slug').length,
  fuzzyMatches: matching.matches.filter(({ method }) => method === 'fuzzy').length,
  proposedMatches: matching.matches.map(({ image, card, score, method }) => ({ cloudinaryOriginalName: image.fileName, nameAfterSuffixRemoval: cloudinaryNameForCard(image.fileName, card.name), normalizedName: normalizeComparison(cloudinaryNameForCard(image.fileName, card.name)), card: card.name, method, score: Number(score.toFixed(3)) })),
  ambiguousMatches: matching.ambiguous.map(({ image, card, score }) => ({ cloudinaryOriginalName: image.fileName, nameAfterSuffixRemoval: cloudinaryNameForCard(image.fileName, card.name), normalizedName: normalizeComparison(cloudinaryNameForCard(image.fileName, card.name)), card: card.name, score: Number(score.toFixed(3)) })),
  duplicateImages: matching.duplicateImages,
  duplicateCards: matching.duplicateCards,
  invalidDeliveryUrls,
  duplicateLocalNames: findDuplicates(assets, 'name'),
  duplicateLocalSlugs: findDuplicates(assets, 'slug'),
  unmatchedCards: matching.unmatchedCards,
  unmatchedImages: matching.unmatchedImages,
}, null, 2))

await prisma.$disconnect()
if (assets.length !== EXPECTED_CARD_COUNT || cards.length !== EXPECTED_CARD_COUNT || cloudinaryImages.length !== EXPECTED_CARD_COUNT || matching.matches.length !== EXPECTED_CARD_COUNT || matching.ambiguous.length || matching.unmatchedImages.length || matching.unmatchedCards.length || matching.duplicateImages.length || matching.duplicateCards.length || invalidDeliveryUrls.length) {
  process.exitCode = 1
}
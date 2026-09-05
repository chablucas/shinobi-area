import { prisma } from '../config/prisma.js'
import { getAllCanonicalCards, getCanonicalCard } from '../game/cardCatalog.js'

const canonicalCards = getAllCanonicalCards()
const controlledImageAliases: Record<string, string> = {
  'ukon-sakon': 'ukon-et-sakon',
}

const normalized = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, 'et')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-+$/g, '')

function extractComparableName(value: string): string[] {
  const source = value.trim()
  const variants = new Set<string>()
  const cleaned = source.replace(/[_]+/g, ' ')
  variants.add(cleaned)
  variants.add(cleaned.replace(/\s+/g, ' '))
  variants.add(normalized(cleaned))
  return [...variants].filter(Boolean)
}

function compareCardName(cardName: string, imageName: string): 'EXACT' | 'NORMALIZED' | 'AMBIGUOUS' | 'MISSING' {
  const cleanCard = cardName.trim()
  const cleanImage = imageName.trim()
  if (!cleanCard || !cleanImage) return 'MISSING'
  if (normalized(cleanCard) === normalized(cleanImage)) return 'EXACT'
  const cardVariants = new Set(extractComparableName(cleanCard))
  const imageVariants = new Set(extractComparableName(cleanImage))
  const match = [...cardVariants].some((variant) => imageVariants.has(variant))
  if (match) return 'NORMALIZED'
  return 'AMBIGUOUS'
}

const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply')
const apply = process.argv.includes('--apply')

const prismaCards = await prisma.card.findMany({ select: { id: true, slug: true, name: true, imageUrl: true, cloudinaryPublicId: true } })
const rows: Array<{ slug: string; canonicalName: string; imageUrl: string | null; imageDetected: string; proposed: string | null; status: string; duplicateImage: boolean }> = []
const duplicateImageSet = new Set<string>()
const seenImages = new Map<string, string>()

for (const prismaCard of prismaCards) {
  const canonical = getCanonicalCard(prismaCard.slug) ?? canonicalCards.find((card) => normalizeText(card.name) === normalizeText(prismaCard.name) || normalizeText(card.slug) === normalizeText(prismaCard.slug))
  const imageName = removeCloudinaryVersionSuffix(prismaCard.cloudinaryPublicId?.split('/').pop() ?? prismaCard.imageUrl?.split('/').pop() ?? '')
  const imageLabel = imageName || '(vide)'
  const proposed = canonical?.slug ?? null
  const usesControlledAlias = canonical
    && controlledImageAliases[normalized(imageName)] === canonical.slug
  const status = canonical ? (usesControlledAlias ? 'NORMALIZED' : compareCardName(canonical.name, imageLabel)) : 'MISSING'
  rows.push({
    slug: prismaCard.slug,
    canonicalName: canonical?.name ?? prismaCard.name,
    imageUrl: prismaCard.imageUrl,
    imageDetected: imageLabel,
    proposed: proposed,
    status,
    duplicateImage: false,
  })

  if (prismaCard.imageUrl) {
    const key = normalizeText(prismaCard.imageUrl)
    if (seenImages.has(key) && seenImages.get(key) !== prismaCard.slug) duplicateImageSet.add(prismaCard.imageUrl)
    else seenImages.set(key, prismaCard.slug)
  }
}

for (const row of rows) {
  if (row.imageUrl) {
    const rowImage = row.imageUrl
    const duplicate = [...rows].filter((candidate) => {
      if (!candidate.imageUrl) return false
      return normalizeText(candidate.imageUrl) === normalizeText(rowImage)
    }).length > 1
    row.duplicateImage = duplicate
  }
}

const stats = {
  TOTAL: rows.length,
  EXACT: rows.filter((row) => row.status === 'EXACT').length,
  NORMALIZED: rows.filter((row) => row.status === 'NORMALIZED').length,
  AMBIGUOUS: rows.filter((row) => row.status === 'AMBIGUOUS').length,
  MISSING: rows.filter((row) => row.status === 'MISSING').length,
  DUPLICATE_IMAGE: rows.filter((row) => row.duplicateImage).length,
  DUPLICATE_SLUG: new Set(canonicalCards.map((card) => card.slug)).size !== canonicalCards.length ? 1 : 0,
}

console.log('REPORT')
console.log(JSON.stringify({ dryRun, apply, stats, rows: rows.slice(0, 10) }, null, 2))
console.log(JSON.stringify({ issues: rows.filter((row) => row.status === 'AMBIGUOUS' || row.status === 'MISSING') }, null, 2))
console.log(`TOTAL ${stats.TOTAL} EXACT ${stats.EXACT} NORMALIZED ${stats.NORMALIZED} AMBIGUOUS ${stats.AMBIGUOUS} MISSING ${stats.MISSING} DUPLICATE_IMAGE ${stats.DUPLICATE_IMAGE} DUPLICATE_SLUG ${stats.DUPLICATE_SLUG}`)

if (apply) {
  const hasIssues = canonicalCards.length !== 163 || new Set(canonicalCards.map((card) => card.slug)).size !== canonicalCards.length || stats.AMBIGUOUS > 0 || stats.MISSING > 0 || stats.DUPLICATE_IMAGE > 0
  if (hasIssues) throw new Error('Refus d’écrire : données non cohérentes pour un apply.')
  for (const row of rows) {
    if (!row.proposed) continue
    await prisma.card.update({ where: { slug: row.slug }, data: { slug: row.proposed, name: getCanonicalCard(row.proposed)?.name ?? row.canonicalName } })
  }
  console.log('APPLY OK')
}

await prisma.$disconnect()

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'et').replace(/[^a-z0-9]+/g, '-')
}

function removeCloudinaryVersionSuffix(value: string): string {
  return value.replace(/_[a-z0-9]{6}$/i, '')
}

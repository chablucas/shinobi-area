import { readdir } from 'node:fs/promises'
import path from 'node:path'

const VALID_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const SOURCE_DIR = path.resolve(process.cwd(), 'import/Carte Naruto')

export type CardAsset = { filePath: string; fileName: string; name: string; slug: string }
export type CloudinaryZipAsset = { fileName: string; publicId: string; secureUrl: string; name: string; slug: string }
export type SimilarityMatch = {
  image: CloudinaryZipAsset
  card: CardAsset
  score: number
  ambiguous: boolean
  method: 'exact' | 'slug' | 'fuzzy'
}

function logicalName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName)).replace(/\s+$/, '').trim()
}

export function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function normalizeComparison(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function cloudinaryBaseName(fileName: string): string {
  const stem = path.basename(fileName, path.extname(fileName))
  const fullName = stem.replace(/_/g, ' ')
  const suffixCandidate = stem.replace(/_[a-z0-9]{6}$/i, '').replace(/_/g, ' ')
  return `${fullName}\n${suffixCandidate}`
}

export function cloudinaryNameCandidates(fileName: string): string[] {
  return cloudinaryBaseName(fileName).split('\n')
}

export function cloudinaryNameForCard(fileName: string, cardName: string): string {
  return cloudinaryNameCandidates(fileName).find((name) => normalizeComparison(name) === normalizeComparison(cardName)) ?? cloudinaryNameCandidates(fileName)[0]
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    let diagonal = previous[0]
    previous[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const above = previous[rightIndex]
      previous[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? diagonal
        : Math.min(previous[rightIndex] + 1, previous[rightIndex - 1] + 1, diagonal + 1)
      diagonal = above
    }
  }
  return previous[right.length]
}

export function similarity(left: string, right: string): number {
  const normalizedLeft = normalizeComparison(left)
  const normalizedRight = normalizeComparison(right)
  if (!normalizedLeft || !normalizedRight) return 0
  return 1 - levenshtein(normalizedLeft, normalizedRight) / Math.max(normalizedLeft.length, normalizedRight.length)
}

export function matchCloudinaryImages(images: CloudinaryZipAsset[], cards: CardAsset[]): { matches: SimilarityMatch[]; ambiguous: SimilarityMatch[]; unmatchedImages: string[]; unmatchedCards: string[]; duplicateImages: string[]; duplicateCards: string[] } {
  const candidates = images.map((image) => {
    const exact = cards.filter((card) => cloudinaryNameCandidates(image.fileName).some((name) => normalizeComparison(name) === normalizeComparison(card.name)))
    if (exact.length === 1) return { image, best: { card: exact[0], score: 1, method: 'exact' as const }, ambiguous: false }
    const ranked = cards.map((card) => ({ card, score: Math.max(...cloudinaryNameCandidates(image.fileName).map((name) => similarity(name, card.name))), method: 'fuzzy' as const })).sort((left, right) => right.score - left.score)
    const best = ranked[0]
    const second = ranked[1]
    return { image, best, ambiguous: !best || best.score < 0.72 || Boolean(second && best.score - second.score < 0.08) }
  }).sort((left, right) => (right.best?.score ?? 0) - (left.best?.score ?? 0))
  const usedCards = new Set<string>()
  const matches: SimilarityMatch[] = []
  const ambiguous: SimilarityMatch[] = []
  const unmatchedImages: string[] = []
  const duplicateImages: string[] = []
  for (const candidate of candidates) {
    if (!candidate.best || candidate.ambiguous || usedCards.has(candidate.best.card.slug)) {
      if (candidate.best && candidate.ambiguous) ambiguous.push({ image: candidate.image, card: candidate.best.card, score: candidate.best.score, ambiguous: true, method: candidate.best.method })
      else if (candidate.best) duplicateImages.push(candidate.image.fileName)
      else unmatchedImages.push(candidate.image.publicId)
      continue
    }
    usedCards.add(candidate.best.card.slug)
    matches.push({ image: candidate.image, card: candidate.best.card, score: candidate.best.score, ambiguous: false, method: candidate.best.method })
  }
  return { matches, ambiguous, unmatchedImages, unmatchedCards: cards.filter((card) => !usedCards.has(card.slug)).map((card) => card.name), duplicateImages, duplicateCards: [...usedCards].filter((slug, index, values) => values.indexOf(slug) !== index) }
}

async function visit(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === '__MACOSX' || entry.name.startsWith('.') || entry.name.startsWith('._')) continue
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await visit(fullPath))
    else if (VALID_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(fullPath)
  }
  return files
}

export async function scanCardAssets(): Promise<CardAsset[]> {
  const files = await visit(SOURCE_DIR)
  return files.sort().map((filePath) => {
    const fileName = path.basename(filePath)
    const name = logicalName(fileName)
    return { filePath, fileName, name, slug: slugify(name) }
  })
}

export function findDuplicates(assets: CardAsset[], field: 'name' | 'slug'): string[] {
  const counts = new Map<string, number>()
  for (const asset of assets) counts.set(asset[field], (counts.get(asset[field]) ?? 0) + 1)
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value)
}

export const EXPECTED_CARD_COUNT = 163
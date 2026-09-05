import { cards as rawCards, cardsBySlug, cardsById } from '../services/gameDataService.js'

export type CanonicalCard = {
  id: number
  slug: string
  name: string
  clans: string[]
  rarity: string
  rarityScore: number
  rarityMeta: { label: string; rank: number; colorName: string; colorHex: string }
  stats: Record<string, number>
  traits: Record<string, unknown>
  signaturePowers?: string[]
  powerIds?: string[]
  dojutsu?: string[]
  avatars?: Array<{ type: string; id: string; name: string }>
  physicalParticularities?: string[]
  physicalTraitIds?: string[]
  transformations?: string[]
  transformationIds?: string[]
}

export type RarityOrderEntry = {
  id: string
  label: string
  rank: number
  colorName: string
  colorHex: string
  minScore: number
  maxScore: number
}

export type CanonicalCatalog = {
  cards: CanonicalCard[]
  rarityOrder: RarityOrderEntry[]
  rules?: Record<string, unknown>
  [key: string]: unknown
}

export const rarityOrder: RarityOrderEntry[] = [
  { id: 'DIVINE', label: 'Divine', rank: 1, colorName: 'Gold', colorHex: '#FFD700', minScore: 90, maxScore: 100 },
  { id: 'LEGENDARY', label: 'Légendaire', rank: 2, colorName: 'Purple', colorHex: '#9370DB', minScore: 75, maxScore: 89 },
  { id: 'EPIC', label: 'Épique', rank: 3, colorName: 'Blue', colorHex: '#1E90FF', minScore: 60, maxScore: 74 },
  { id: 'RARE', label: 'Rare', rank: 4, colorName: 'Green', colorHex: '#32CD32', minScore: 40, maxScore: 59 },
  { id: 'COMMON', label: 'Commune', rank: 5, colorName: 'Gray', colorHex: '#808080', minScore: 0, maxScore: 39 },
]

export const CARD_CATALOG: CanonicalCard[] = rawCards.map((card) => {
  const rarityMeta = card.rarityMeta ?? {
    label: card.rarity,
    rank: 0,
    colorName: '',
    colorHex: '#000000',
  }
  return {
    id: card.id,
    slug: card.slug,
    name: card.name,
    clans: card.clans ?? [],
    rarity: card.rarity,
    rarityScore: card.rarityScore ?? 0,
    rarityMeta,
    stats: card.stats,
    traits: card.traits ?? {},
    signaturePowers: card.signaturePowers,
    powerIds: card.powerIds,
    dojutsu: card.dojutsu,
    avatars: card.avatars,
    physicalParticularities: card.physicalParticularities,
    physicalTraitIds: card.physicalTraitIds,
    transformations: card.transformations,
    transformationIds: card.transformationIds,
  }
})

const localCardsBySlug = new Map<string, CanonicalCard>()
const localCardsById = new Map<number, CanonicalCard>()
const legacyAliasBySlug = new Map<string, string>()

function normalizeSlugValue(value: string): string {
  return value
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'et')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

for (const card of CARD_CATALOG) {
  if (!card.slug || !card.name) throw new Error(`Carte canonique invalide : ${card.id ?? 'inconnu'} a un slug ou un nom vide.`)
  if (localCardsBySlug.has(card.slug)) throw new Error(`Slug canonique dupliqué : ${card.slug}`)
  localCardsBySlug.set(card.slug, card)
  localCardsById.set(card.id, card)

  const normalizedSlug = normalizeSlugValue(card.slug)
  const normalizedName = normalizeSlugValue(card.name)
  const aliasCandidates = new Set<string>([normalizedSlug, normalizedName])
  aliasCandidates.add(normalizedSlug.replace(/-(et|and)-/g, '-'))
  aliasCandidates.add(normalizedName.replace(/-(et|and)-/g, '-'))
  aliasCandidates.add(normalizedSlug.replace(/-?(et|and)-?/g, '-'))
  aliasCandidates.add(normalizedName.replace(/-?(et|and)-?/g, '-'))
  aliasCandidates.add(normalizedSlug.replace(/-/g, ''))
  aliasCandidates.add(normalizedName.replace(/-/g, ''))

  for (const candidate of aliasCandidates) {
    if (!candidate) continue
    if (!legacyAliasBySlug.has(candidate)) legacyAliasBySlug.set(candidate, card.slug)
  }

  const baseName = card.name.replace(/\s+(Prime|Malade|Orange|Blanc|Vieux)$/i, '')
  if (baseName !== card.name) {
    const normalizedBaseName = normalizeSlugValue(baseName)
    if (!legacyAliasBySlug.has(normalizedBaseName)) legacyAliasBySlug.set(normalizedBaseName, card.slug)
  }
}

export function getAllCanonicalCards(): CanonicalCard[] {
  return [...CARD_CATALOG]
}

export function getCanonicalCard(slug: string): CanonicalCard | undefined {
  const direct = localCardsBySlug.get(slug)
  if (direct) return direct
  const normalized = normalizeSlugValue(slug)
  const aliasTarget = legacyAliasBySlug.get(normalized)
  return aliasTarget ? localCardsBySlug.get(aliasTarget) : undefined
}

export function resolveCanonicalSlug(slug: string): string {
  return getCanonicalCard(slug)?.slug ?? slug
}

export function getCanonicalCardById(id: number): CanonicalCard | undefined {
  return localCardsById.get(id)
}

export function getRarityMeta(rarityId: string): RarityOrderEntry | undefined {
  return rarityOrder.find((entry) => entry.id === rarityId)
}

export function validateCanonicalCatalog(): void {
  if (CARD_CATALOG.length !== 163) {
    throw new Error(`Le catalogue canonique doit contenir exactement 163 cartes. ${CARD_CATALOG.length} trouvées.`)
  }

  const invalid = CARD_CATALOG.filter((card) => !card.id || !card.slug || !card.name || !card.stats || !card.rarity)
  if (invalid.length > 0) {
    throw new Error(`Cartes invalides dans le catalogue canonique : ${invalid.map((card) => card.slug || card.id).join(', ')}`)
  }

  const slugSet = new Set(CARD_CATALOG.map((card) => card.slug))
  if (slugSet.size !== CARD_CATALOG.length) {
    throw new Error('Le catalogue canonique contient des slugs dupliqués.')
  }
}

validateCanonicalCatalog()

export const catalogRules = {}

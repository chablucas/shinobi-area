import canonicalCardsData from '../data/shinobi-cards.json' with { type: 'json' }

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
  rules?: {
    clanRules?: Record<string, { bonuses?: Array<{ target: string; percent: number }>; permissions?: string[] }>
    kekkeiMoraRules?: Record<string, { trigger?: Record<string, unknown>; bonuses?: Array<{ target: string; percent: number }> }>
  }
  [key: string]: unknown
}

const catalog = canonicalCardsData as CanonicalCatalog
export const CARD_CATALOG = catalog.cards ?? []
export const rarityOrder = catalog.rarityOrder ?? []

const cardsBySlug = new Map<string, CanonicalCard>()
const cardsById = new Map<number, CanonicalCard>()
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
  if (cardsBySlug.has(card.slug)) throw new Error(`Slug canonique dupliqué : ${card.slug}`)
  cardsBySlug.set(card.slug, card)
  cardsById.set(card.id, card)

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
  const direct = cardsBySlug.get(slug)
  if (direct) return direct
  const normalized = normalizeSlugValue(slug)
  const aliasTarget = legacyAliasBySlug.get(normalized)
  return aliasTarget ? cardsBySlug.get(aliasTarget) : undefined
}

export function resolveCanonicalSlug(slug: string): string {
  return getCanonicalCard(slug)?.slug ?? slug
}

export function getCanonicalCardById(id: number): CanonicalCard | undefined {
  return cardsById.get(id)
}

export function getRarityMeta(rarityId: string): RarityOrderEntry | undefined {
  return rarityOrder.find((entry) => entry.id === rarityId)
}

export function validateCanonicalCatalog(): void {
  if (CARD_CATALOG.length !== 163) {
    throw new Error(`Le catalogue canonique doit contenir exactement 163 cartes. ${CARD_CATALOG.length} trouvées.`)
  }

  const invalid = CARD_CATALOG.filter((card) => !card.id || !card.slug || !card.name || !card.stats || !card.traits || !card.rarity)
  if (invalid.length > 0) {
    throw new Error(`Cartes invalides dans le catalogue canonique : ${invalid.map((card) => card.slug || card.id).join(', ')}`)
  }

  const slugSet = new Set(CARD_CATALOG.map((card) => card.slug))
  if (slugSet.size !== CARD_CATALOG.length) {
    throw new Error('Le catalogue canonique contient des slugs dupliqués.')
  }

  const unknownRarities = CARD_CATALOG.filter((card) => !rarityOrder.some((entry) => entry.id === card.rarity))
  if (unknownRarities.length > 0) {
    throw new Error(`Raretés inconnues dans le catalogue canonique : ${unknownRarities.map((card) => `${card.slug}:${card.rarity}`).join(', ')}`)
  }
}

validateCanonicalCatalog()

export const catalogRules = catalog.rules ?? {}

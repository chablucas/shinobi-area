import teamAuctionPowerJson from '../data/team-auction-power.json' with { type: 'json' }
import { getAllCanonicalCards } from './cardCatalog.js'

type TeamAuctionPowerCard = { slug: string; name: string; generalScore: number }
type TeamAuctionPowerFile = {
  schemaVersion: string
  mode: string
  joinKey: string
  scoreField: string
  scoreRange: { min: number; max: number }
  cards: TeamAuctionPowerCard[]
}

const powerFile = teamAuctionPowerJson as TeamAuctionPowerFile
const canonicalCards = getAllCanonicalCards()
const canonicalSlugs = new Set(canonicalCards.map((card) => card.slug))
const powerBySlug = new Map<string, TeamAuctionPowerCard>()

if (powerFile.mode !== 'TEAM_AUCTION' || powerFile.joinKey !== 'slug' || powerFile.scoreField !== 'generalScore') {
  throw new Error('Configuration team-auction-power.json invalide.')
}
if (powerFile.scoreRange.min !== 0 || powerFile.scoreRange.max !== 100) {
  throw new Error('La plage generalScore de team-auction-power.json doit être 0–100.')
}
for (const entry of powerFile.cards) {
  if (!entry.slug || powerBySlug.has(entry.slug)) throw new Error(`Slug Team Auction dupliqué ou vide : ${entry.slug || 'inconnu'}`)
  if (!canonicalSlugs.has(entry.slug)) throw new Error(`Slug Team Auction absent du catalogue canonique : ${entry.slug}`)
  if (!Number.isFinite(entry.generalScore) || entry.generalScore < 0 || entry.generalScore > 100) {
    throw new Error(`generalScore invalide pour ${entry.slug}.`)
  }
  powerBySlug.set(entry.slug, entry)
}
if (powerBySlug.size !== canonicalCards.length) {
  const missing = canonicalCards.filter((card) => !powerBySlug.has(card.slug)).map((card) => card.slug)
  throw new Error(`Scores Team Auction manquants (${missing.join(', ')}).`)
}

export function getTeamAuctionPowerScore(slug: string): number {
  const entry = powerBySlug.get(slug)
  if (!entry) throw new Error(`Aucun generalScore Team Auction pour le slug canonique ${slug}.`)
  return entry.generalScore
}

export function listTeamAuctionPower(): TeamAuctionPowerCard[] {
  return [...powerBySlug.values()]
}
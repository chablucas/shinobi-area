import teamAuctionRulesJson from '../data/rules/team-auction.json' with { type: 'json' }

export type TeamAuctionRules = {
  schemaVersion: string
  gameName: string
  minBid: number
  bidUnit: number
  openingBid: number
  allowAllIn: boolean
  allowPass: boolean
  passIsFinalForCurrentCard: boolean
  rotation: Record<string, string[]>
  scoring: {
    character: { method: string; minimum: number; maximum: number }
    team: { method: string }
    victory: { method: string }
    tiebreak: { method: string }
  }
  ai: Record<string, number>
}

export const teamAuctionRules = teamAuctionRulesJson as unknown as TeamAuctionRules

export function normalizeBid(amount: number, budget: number): number {
  const unit = teamAuctionRules.bidUnit
  const base = Math.floor(Math.max(0, Math.min(amount, budget)) / unit) * unit
  return base
}

export function isValidBid(amount: number, currentBid: number, budget: number): boolean {
  if (!Number.isFinite(amount)) return false
  if (amount <= 0) return false
  if (amount > budget) return false
  if (amount <= currentBid) return false
  if (amount % teamAuctionRules.bidUnit !== 0) return false
  return true
}

export function getMinimumOpenBid(playerBudget: number): number {
  return playerBudget >= teamAuctionRules.openingBid ? teamAuctionRules.openingBid : 0
}

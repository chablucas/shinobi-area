import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from './cardApi'
import type { RealtimeGameState } from './socialApi'

function socketUrl() {
  if (API_BASE_URL.startsWith('http')) return new URL(API_BASE_URL).origin
  return window.location.origin
}

export function connectGameSocket(token: string): GameSocket {
  return io(socketUrl(), { auth: { token }, autoConnect: true })
}

export type TeamAuctionMode = '1v1-ai' | '1v1-real' | '1v1v1-real'
export type TeamAuctionCard = { id: number; name: string; slug: string; imageUrl: string | null; rarity: string; rarityScore: number; stats?: Record<string, number> }
export type TeamAuctionState = {
  gameId: string
  hostId: number | null
  mode: TeamAuctionMode
  phase: 'LOBBY' | 'DRAW' | 'BIDDING' | 'PLACEMENT' | 'RESULTS' | 'FINISHED'
  teamSizes: number[]
  initialBudget: number
  roundNumber: number
  currentCard: TeamAuctionCard | null
  currentBid: number
  currentBidderId: number | string | null
  currentTurnId: number | string | null
  winnerId: number | string | null
  rules: { minBid: number; bidUnit: number; allowAllIn: boolean }
  finalResults: { winnerId: number | string | null; winners: Array<number | string>; teams: Array<{ playerId: number | string; teamNumber: number; score: number; won: boolean }>; summary: Array<{ playerId: number | string; victories: number; totalTeamScore: number }>; draw: boolean } | null
  players: Array<{ id: number | string; displayName: string; isAi: boolean; budget: number; passedCurrentRound: boolean; activeCurrentRound: boolean; teams: Array<{ teamNumber: number; capacity: number; average: number; cards: TeamAuctionCard[] }> }>
}

export type GameSocket = Socket<
  { 'game:state': (state: RealtimeGameState) => void; 'game:error': (error: { message: string }) => void; 'team-auction:state': (state: TeamAuctionState) => void; 'team-auction:error': (error: { message: string }) => void },
  { 'game:join': (gameId: string, acknowledge?: (response: { ok: boolean; message?: string }) => void) => void; 'game:request-state': () => void; 'game:draw': (gameId: string) => void; 'game:place-card': (payload: { gameId: string; category: string }) => void; 'team-auction:create': (payload: { mode: TeamAuctionMode; teamSizes: number[]; initialBudget: number }, acknowledge?: (response: { ok: boolean; gameId?: string; message?: string }) => void) => void; 'team-auction:join': (gameId: string, acknowledge?: (response: { ok: boolean; gameId?: string; message?: string }) => void) => void; 'team-auction:start': (gameId: string) => void; 'team-auction:request-state': (gameId: string) => void; 'team-auction:action': (payload: { gameId: string; action: 'bid' | 'pass' | 'allin' | 'place'; amount?: number; teamIndex?: number }) => void; 'team-auction:leave': (gameId: string) => void }
>

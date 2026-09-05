import type { ChallengeMode } from './socialApi'
import type { TeamAuctionMode } from './realtimeApi'

export type TeamAuctionLobbyMode = 'team-1v1' | 'team-1v1v1'

/** Reconnaît les modes de salon Team Auction réellement renvoyés par le serveur. */
export function isTeamAuctionMode(mode: unknown): mode is TeamAuctionLobbyMode {
  return mode === 'team-1v1' || mode === 'team-1v1v1'
}

/** Mappe un mode de lobby Team Auction vers le mode realtime attendu par /team-game. */
export function teamAuctionSocketMode(mode: TeamAuctionLobbyMode): TeamAuctionMode {
  return mode === 'team-1v1' ? '1v1-real' : '1v1v1-real'
}

/** Route cible du salon Team Auction en conservant exactement le même gameId (lobby.id). */
export function teamAuctionGameRoute(mode: ChallengeMode, gameId: string) {
  const socketMode = isTeamAuctionMode(mode) ? teamAuctionSocketMode(mode) : '1v1-real'
  return { path: '/team-game', query: { mode: socketMode, gameId } }
}

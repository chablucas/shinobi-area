import { API_BASE_URL } from './cardApi'

export type PublicUser = { id: number; displayName: string; avatarUrl: string | null; friendshipStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | null; friendshipDirection: 'sent' | 'received' | null; friendshipRequestId?: number | null }
export type Friend = { id: number; displayName: string; avatarUrl: string | null }
export type FriendRequest = { id: number; status: 'PENDING'; createdAt: string; sender: Friend; receiver: Friend }
export type SearchCard = { id: number; name: string; slug: string; imageUrl: string | null }
export type SearchResult = { players: PublicUser[]; shinobis: SearchCard[] }
export type ChallengeMode = '1v1' | '1v1v1' | 'team-1v1' | 'team-1v1v1'
export type GameInvite = { id: string; lobbyId: string; mode: ChallengeMode; status: 'PENDING'; createdAt: string; creator: Friend }
export type LobbyPlayer = Partial<PublicUser> & { id: number | null; displayName: string; avatarUrl: string | null; status: 'ACCEPTED' | 'PENDING' | 'REJECTED' | 'CANCELLED'; inviteId: string | null; isAi: boolean }
export type GameLobby = { id: string; mode: ChallengeMode; creatorId: number; includesAi: boolean; players: LobbyPlayer[]; status: 'WAITING' | 'READY' | 'PLAYING'; createdAt: string; updatedAt: string }
export type StartGameResult = { lobby: GameLobby; game: { id: string; lobbyId: string; mode: ChallengeMode; status: 'PLAYING' | 'FINISHED' } }

export class SocialApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'SocialApiError'
  }
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new SocialApiError(payload.error ?? 'Une erreur sociale est survenue.', response.status)
  return payload as T
}

export function searchGlobal(token: string, query: string) { return request<SearchResult>(token, `/search?q=${encodeURIComponent(query)}`) }
export function listFriends(token: string) { return request<Friend[]>(token, '/friends') }
export function listFriendRequests(token: string, direction: 'received' | 'sent') { return request<FriendRequest[]>(token, `/friends/requests/${direction}`) }
export function sendFriendRequest(token: string, userId: number) { return request<{ id: number; status: string; receiver: Friend }>(token, `/friends/${userId}`, { method: 'POST' }) }
export function acceptFriendRequest(token: string, requestId: number) { return request<unknown>(token, `/friends/requests/${requestId}/accept`, { method: 'POST' }) }
export function rejectFriendRequest(token: string, requestId: number) { return request<unknown>(token, `/friends/requests/${requestId}/reject`, { method: 'POST' }) }
export function getPublicUser(token: string, userId: number) { return request<PublicUser>(token, `/users/${userId}`) }
export function listGameInvites(token: string) { return request<GameInvite[]>(token, '/game/invites') }
export function createGameLobby(token: string, mode: ChallengeMode, opponentIds: number[], includesAi = false) { return request<GameLobby>(token, '/game/lobbies', { method: 'POST', body: JSON.stringify({ mode, opponentIds, includesAi }) }) }
export function acceptGameInvite(token: string, inviteId: string) { return request<GameLobby>(token, `/game/invites/${inviteId}/accept`, { method: 'POST' }) }
export function rejectGameInvite(token: string, inviteId: string) { return request<GameLobby>(token, `/game/invites/${inviteId}/reject`, { method: 'POST' }) }
export function getGameLobby(token: string, lobbyId: string) { return request<GameLobby>(token, `/game/lobbies/${lobbyId}`) }
export function getLobbyGame(token: string, lobbyId: string) { return request<RealtimeGameState>(token, `/game/lobbies/${lobbyId}/game`) }
export function startGameLobby(token: string, lobbyId: string) { return request<StartGameResult>(token, `/game/lobbies/${lobbyId}/start`, { method: 'POST' }) }
export function calculateRealtimeGameResult(token: string, gameId: string) { return request<RealtimeGameState>(token, `/game/games/${gameId}/result/auto`, { method: 'POST' }) }
export function chooseRealtimeGameResult(token: string, gameId: string, winnerNumber: 1 | 2 | null, isDraw: boolean) { return request<RealtimeGameState>(token, `/game/games/${gameId}/result/manual`, { method: 'POST', body: JSON.stringify({ winnerNumber, isDraw }) }) }

export type RealtimeCard = { id: number; slug: string; name: string; clans: string[]; stats: Record<string, number>; imageUrl: string | null; eligibleSlots: string[] }
export type RealtimePlayer = { userId: number | null; displayName: string; playerNumber: number; cardsRemaining: number; pendingCard: RealtimeCard | null; slots: Record<string, RealtimeCard | null> }
export type AutoRealtimeResult = { resultMode: 'AUTO'; winner: 'player1' | 'player2' | 'draw'; winnerNumber: 1 | 2 | null; isDraw: boolean; player1Total: number; player2Total: number; player1: { baseStats: Record<string, number>; finalStats: Record<string, number>; appliedRules: Array<{ ruleId: string; label: string; target: string; before: number; after: number; operation: string; value: number }>; validationErrors: Array<{ ruleId: string; message: string }>; total: number }; player2: { baseStats: Record<string, number>; finalStats: Record<string, number>; appliedRules: Array<{ ruleId: string; label: string; target: string; before: number; after: number; operation: string; value: number }>; validationErrors: Array<{ ruleId: string; message: string }>; total: number } }
export type ManualRealtimeResult = { resultMode: 'MANUAL'; winnerNumber: 1 | 2 | null; isDraw: boolean }
export type RealtimeGameResult = AutoRealtimeResult | ManualRealtimeResult | { winner: 'player1' | 'player2' | 'draw'; player1Total: number; player2Total: number }
export type RealtimeGameState = { id: string; lobbyId: string; mode: ChallengeMode; status: 'PLAYING' | 'AWAITING_RESULT' | 'FINISHED'; currentPlayerNumber: number; turnNumber: number; stateVersion?: number; players: RealtimePlayer[]; result: RealtimeGameResult | null }

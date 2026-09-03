import { API_BASE_URL } from './cardApi'

export type PublicUser = { id: number; displayName: string; avatarUrl: string | null; friendshipStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | null; friendshipDirection: 'sent' | 'received' | null; friendshipRequestId?: number | null }
export type Friend = { id: number; displayName: string; avatarUrl: string | null }
export type FriendRequest = { id: number; status: 'PENDING'; createdAt: string; sender: Friend; receiver: Friend }
export type SearchCard = { id: number; name: string; slug: string; imageUrl: string | null }
export type SearchResult = { players: PublicUser[]; shinobis: SearchCard[] }
export type ChallengeMode = '1v1' | '1v1v1'
export type GameLobby = { id: string; mode: ChallengeMode; creatorId: number; players: PublicUser[]; status: 'PENDING' | 'READY' | 'IN_PROGRESS'; currentTurnPlayerId: number | null }

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'Une erreur sociale est survenue.')
  return payload as T
}

export function searchGlobal(token: string, query: string) { return request<SearchResult>(token, `/search?q=${encodeURIComponent(query)}`) }
export function listFriends(token: string) { return request<Friend[]>(token, '/friends') }
export function listFriendRequests(token: string, direction: 'received' | 'sent') { return request<FriendRequest[]>(token, `/friends/requests/${direction}`) }
export function sendFriendRequest(token: string, userId: number) { return request<{ id: number; status: string; receiver: Friend }>(token, `/friends/${userId}`, { method: 'POST' }) }
export function acceptFriendRequest(token: string, requestId: number) { return request<unknown>(token, `/friends/requests/${requestId}/accept`, { method: 'POST' }) }
export function rejectFriendRequest(token: string, requestId: number) { return request<unknown>(token, `/friends/requests/${requestId}/reject`, { method: 'POST' }) }
export function getPublicUser(token: string, userId: number) { return request<PublicUser>(token, `/users/${userId}`) }

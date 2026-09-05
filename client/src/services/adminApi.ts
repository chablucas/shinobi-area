import { API_BASE_URL } from './cardApi'

export type AdminOverview = {
  totalCards: number
  totalUsers: number
  rarityBreakdown: Array<{ rarity: string; count: number }>
}

export type AdminCardSummary = {
  id: number
  slug: string
  name: string
  imageUrl: string | null
  rarity: string
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'Action impossible.')
  return payload as T
}

export function fetchAdminOverview(token: string) {
  return request<AdminOverview>('/admin/overview', {}, token)
}

export function fetchAdminCards(token: string, search = '', rarity = '') {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (rarity.trim()) params.set('rarity', rarity.trim())
  return request<AdminCardSummary[]>(`/admin/cards${params.toString() ? `?${params.toString()}` : ''}`, {}, token)
}

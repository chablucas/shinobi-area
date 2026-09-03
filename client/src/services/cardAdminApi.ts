import type { Card, CardModifier } from '../types/card'
import { API_BASE_URL } from './cardApi'

async function adminRequest<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/admin/cards${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) } })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error ?? 'Action administrateur impossible.')
  return payload as T
}

export const fetchAdminCard = (token: string, slug: string) => adminRequest<Card>(token, `/${encodeURIComponent(slug)}`)
export const saveStatOverride = (token: string, slug: string, statKey: string, value: number) => adminRequest<unknown>(token, `/${encodeURIComponent(slug)}/stats/${encodeURIComponent(statKey)}`, { method: 'PUT', body: JSON.stringify({ value }) })
export const resetStatOverride = (token: string, slug: string, statKey: string) => adminRequest<void>(token, `/${encodeURIComponent(slug)}/stats/${encodeURIComponent(statKey)}`, { method: 'DELETE' })
export const saveRarityOverride = (token: string, slug: string, rarity: string) => adminRequest<unknown>(token, `/${encodeURIComponent(slug)}/rarity`, { method: 'PUT', body: JSON.stringify({ rarity }) })
export const resetRarityOverride = (token: string, slug: string) => adminRequest<void>(token, `/${encodeURIComponent(slug)}/rarity`, { method: 'DELETE' })
export const createCardModifier = (token: string, slug: string, modifier: Omit<CardModifier, 'id'>) => adminRequest<CardModifier>(token, `/${encodeURIComponent(slug)}/modifiers`, { method: 'POST', body: JSON.stringify(modifier) })
export const updateCardModifier = (token: string, id: number, modifier: Omit<CardModifier, 'id'>) => adminRequest<CardModifier>(token, `/modifiers/${id}`, { method: 'PATCH', body: JSON.stringify(modifier) })
export const deleteCardModifier = (token: string, id: number) => adminRequest<void>(token, `/modifiers/${id}`, { method: 'DELETE' })
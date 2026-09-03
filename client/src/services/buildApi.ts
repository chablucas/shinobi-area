import { API_BASE_URL } from './cardApi'

export type SavedBuild = { id: number; name: string; createdAt: string; slots: Array<{ id: number; categorySlug: string; cardId: number; card: { id: number; name: string; imageUrl?: string | null } }> }

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'Impossible de charger les compositions.')
  return payload as T
}

export function fetchBuilds(token: string) { return request<SavedBuild[]>(token, '/builds') }
export function saveBuild(token: string, name: string, slots: Array<{ categorySlug: string; cardId: number }>) { return request<SavedBuild>(token, '/builds', { method: 'POST', body: JSON.stringify({ name, slots }) }) }
export function deleteBuild(token: string, id: number) { return request<void>(token, `/builds/${id}`, { method: 'DELETE' }) }

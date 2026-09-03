import type { Card } from '../types/card'

function getApiBaseUrl(): string {
  if (import.meta.env.DEV) return '/api'

  const configuredUrl = import.meta.env.VITE_API_URL?.trim()
  if (!configuredUrl) {
    throw new Error('VITE_API_URL doit être configurée en production.')
  }

  let apiUrl: URL
  try {
    apiUrl = new URL(configuredUrl)
  } catch {
    throw new Error('VITE_API_URL doit être une URL publique valide.')
  }

  if (apiUrl.protocol !== 'http:' && apiUrl.protocol !== 'https:') {
    throw new Error('VITE_API_URL doit utiliser HTTP ou HTTPS.')
  }

  const apiPath = apiUrl.pathname.replace(/\/+$/, '').replace(/\/api$/, '')
  return `${apiUrl.origin}${apiPath}/api`
}

export const API_BASE_URL = getApiBaseUrl()

export async function fetchAllCards(): Promise<Card[]> {
  const cards: Card[] = []
  let page = 1
  let pages = 1

  do {
    const requestUrl = `${API_BASE_URL}/cards?limit=100&page=${page}`
    console.debug('[cardApi] URL appelée:', requestUrl)

    let response: Response
    try {
      response = await fetch(requestUrl)
    } catch (error) {
      console.error('[cardApi] Échec fetch:', error instanceof Error ? error.message : String(error))
      throw error
    }

    console.debug('[cardApi] Status HTTP:', response.status)
    if (!response.ok) throw new Error('Impossible de charger les cartes.')
    const payload = await response.json()
    cards.push(...payload.data)
    pages = payload.pagination.pages
    page += 1
  } while (page <= pages)

  return cards
}
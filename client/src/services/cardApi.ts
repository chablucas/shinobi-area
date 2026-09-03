import type { Card } from '../types/card'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export async function fetchAllCards(): Promise<Card[]> {
  const cards: Card[] = []
  let page = 1
  let pages = 1

  do {
    const response = await fetch(`${API_URL}/api/cards?limit=100&page=${page}`)
    if (!response.ok) throw new Error('Impossible de charger les cartes.')
    const payload = await response.json()
    cards.push(...payload.data)
    pages = payload.pagination.pages
    page += 1
  } while (page <= pages)

  return cards
}
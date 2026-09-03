import type { Request, Response } from 'express'
import { getCard, listCards } from '../services/cardService.js'

export async function getCards(request: Request, response: Response) {
  const page = Math.max(1, Number.parseInt(String(request.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(request.query.limit ?? '20'), 10) || 20))
  response.json(await listCards(page, limit))
}

export async function getCardByIdOrSlug(request: Request, response: Response) {
  const card = await getCard(String(request.params.idOrSlug))
  if (!card) {
    response.status(404).json({ error: 'Carte introuvable' })
    return
  }
  response.json(card)
}
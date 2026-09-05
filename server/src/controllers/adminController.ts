import type { Request, Response } from 'express'
import { getAdminOverview, listAdminCards, promoteAdminByEmail } from '../services/adminService.js'

export async function getAdminOverviewController(_request: Request, response: Response) {
  response.json(await getAdminOverview())
}

export async function getAdminCardsController(request: Request, response: Response) {
  const search = typeof request.query.search === 'string' ? request.query.search : ''
  const rarity = typeof request.query.rarity === 'string' ? request.query.rarity : null
  response.json(await listAdminCards(search, rarity))
}

export async function promoteAdminController(request: Request, response: Response) {
  const email = typeof request.body?.email === 'string' ? request.body.email : ''
  if (!email.trim()) {
    response.status(400).json({ error: 'Un email est requis.' })
    return
  }

  const result = await promoteAdminByEmail(email)
  if (!result.promoted) {
    response.status(404).json({ error: 'Aucun utilisateur trouvé pour cet email.' })
    return
  }

  response.json(result)
}

import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { globalSearch } from '../services/searchService.js'

export async function search(request: Request, response: Response) {
  const query = String(request.query.q ?? '').trim()
  if (query.length > 80) { response.status(400).json({ error: 'Recherche trop longue.' }); return }
  response.json(await globalSearch((request as AuthenticatedRequest).userId, query))
}
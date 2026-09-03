import type { Request, Response } from 'express'
import { recordResult, updateDisplayName } from '../services/authService.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'

export async function updateProfile(request: Request, response: Response) {
  const { displayName } = request.body ?? {}
  if (typeof displayName !== 'string' || !displayName.trim()) {
    response.status(400).json({ error: 'Le nom est requis.' })
    return
  }
  response.json(await updateDisplayName((request as AuthenticatedRequest).userId, displayName))
}

export async function recordGameResult(request: Request, response: Response) {
  const { gameId, won } = request.body ?? {}
  if (typeof gameId !== 'string' || !gameId.trim() || typeof won !== 'boolean') {
    response.status(400).json({ error: 'Identifiant de partie et résultat requis.' })
    return
  }
  response.json(await recordResult((request as AuthenticatedRequest).userId, gameId, won))
}

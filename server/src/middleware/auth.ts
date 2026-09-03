import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { requireJwtSecret } from '../config/env.js'

export type AuthenticatedRequest = Request & { userId: number }

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    response.status(401).json({ error: 'Authentification requise' })
    return
  }
  try {
    const payload = jwt.verify(token, requireJwtSecret())
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Token invalide')
    ;(request as AuthenticatedRequest).userId = Number(payload.sub)
    if (!Number.isInteger((request as AuthenticatedRequest).userId)) throw new Error('Token invalide')
    next()
  } catch {
    response.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

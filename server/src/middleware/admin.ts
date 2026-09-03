import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import type { AuthenticatedRequest } from './auth.js'

export async function requireAdmin(request: Request, response: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: (request as AuthenticatedRequest).userId }, select: { role: true } })
  if (user?.role !== 'ADMIN') { response.status(403).json({ error: 'Droits administrateur requis.' }); return }
  next()
}
import type { Request, Response } from 'express'
import { getCurrentUser, login, register } from '../services/authService.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'

function credentials(request: Request) {
  const { email, password, displayName } = request.body ?? {}
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || password.length < 6) {
    throw Object.assign(new Error('Email et mot de passe valides requis (6 caractères minimum).'), { statusCode: 400 })
  }
  return { email, password, displayName }
}

export async function registerUser(request: Request, response: Response) {
  const { email, password, displayName } = credentials(request)
  if (typeof displayName !== 'string' || !displayName.trim()) {
    response.status(400).json({ error: 'Le nom est requis.' })
    return
  }
  response.status(201).json(await register(email, password, displayName))
}

export async function loginUser(request: Request, response: Response) {
  const { email, password } = credentials(request)
  response.json(await login(email, password))
}

export async function currentUser(request: Request, response: Response) {
  response.json(await getCurrentUser((request as AuthenticatedRequest).userId))
}

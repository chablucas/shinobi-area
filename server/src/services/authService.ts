import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma.js'
import { requireJwtSecret } from '../config/env.js'

export type PublicUser = { id: number; email: string; displayName: string; wins: number; losses: number; createdAt: Date; updatedAt: Date }

function publicUser(user: PublicUser): PublicUser {
  return user
}

function createToken(userId: number): string {
  return jwt.sign({}, requireJwtSecret(), { subject: String(userId), expiresIn: '7d' })
}

export async function register(email: string, password: string, displayName: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) throw Object.assign(new Error('Cet email est déjà utilisé.'), { statusCode: 409 })
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({ data: { email: normalizedEmail, passwordHash, displayName: displayName.trim() } })
  return { token: createToken(user.id), user: publicUser(user) }
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw Object.assign(new Error('Email ou mot de passe incorrect.'), { statusCode: 401 })
  }
  return { token: createToken(user.id), user: publicUser(user) }
}

export async function getCurrentUser(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw Object.assign(new Error('Utilisateur introuvable.'), { statusCode: 404 })
  return publicUser(user)
}

export async function updateDisplayName(userId: number, displayName: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { displayName: displayName.trim() } })
  return publicUser(user)
}

export async function recordResult(userId: number, gameId: string, won: boolean) {
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.gameResult.create({ data: { userId, gameId, won } })
      await transaction.user.update({ where: { id: userId }, data: won ? { wins: { increment: 1 } } : { losses: { increment: 1 } } })
    })
    return { recorded: true }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') return { recorded: false }
    throw error
  }
}

import type { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'

export async function getCategories(_request: Request, response: Response) {
  response.json(await prisma.category.findMany({ orderBy: { position: 'asc' } }))
}
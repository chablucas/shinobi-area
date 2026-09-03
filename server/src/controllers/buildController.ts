import type { Request, Response } from 'express'
import { createBuild, deleteBuild, getBuild, listBuilds } from '../services/buildService.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'

function userId(request: Request) { return (request as AuthenticatedRequest).userId }

export async function getBuilds(request: Request, response: Response) { response.json(await listBuilds(userId(request))) }
export async function getBuildById(request: Request, response: Response) { response.json(await getBuild(userId(request), Number(request.params.id))) }
export async function postBuild(request: Request, response: Response) {
  const { name, slots } = request.body ?? {}
  if (typeof name !== 'string' || typeof slots === 'undefined') { response.status(400).json({ error: 'Nom et slots requis.' }); return }
  response.status(201).json(await createBuild(userId(request), name, slots))
}
export async function removeBuild(request: Request, response: Response) { await deleteBuild(userId(request), Number(request.params.id)); response.status(204).send() }

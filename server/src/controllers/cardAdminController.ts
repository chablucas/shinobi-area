import type { Request, Response } from 'express'
import { createModifier, deleteModifier, deleteRarity, deleteStat, getEffectiveCard, updateModifier, updateRarity, updateStat } from '../services/cardAdminService.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
const slug = (request: Request) => String(request.params.slug)
const body = (request: Request) => request.body as Record<string, unknown>
export async function adminCard(request: Request, response: Response) { response.json(await getEffectiveCard(slug(request))) }
export async function adminStat(request: Request, response: Response) { response.json(await updateStat(slug(request), String(request.params.statKey), body(request).value)) }
export async function resetStat(request: Request, response: Response) { await deleteStat(slug(request), String(request.params.statKey)); response.status(204).send() }
export async function adminRarity(request: Request, response: Response) { response.json(await updateRarity(slug(request), body(request).rarity)) }
export async function resetRarity(request: Request, response: Response) { await deleteRarity(slug(request)); response.status(204).send() }
export async function postModifier(request: Request, response: Response) { response.status(201).json(await createModifier(slug(request), body(request))) }
export async function patchModifier(request: Request, response: Response) { response.json(await updateModifier(Number(request.params.id), body(request))) }
export async function removeModifier(request: Request, response: Response) { await deleteModifier(Number(request.params.id)); response.status(204).send() }
import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { acceptFriendRequest, cancelFriendRequest, getPublicUser, listFriendRequests, listFriends, rejectFriendRequest, removeFriend, searchUsers, sendFriendRequest } from '../services/friendshipService.js'

function userId(request: Request) { return (request as AuthenticatedRequest).userId }
function numeric(value: unknown) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : 0 }

export async function getFriends(request: Request, response: Response) { response.json(await listFriends(userId(request))) }
export async function getReceivedRequests(request: Request, response: Response) { response.json(await listFriendRequests(userId(request), 'received')) }
export async function getSentRequests(request: Request, response: Response) { response.json(await listFriendRequests(userId(request), 'sent')) }
export async function searchFriendUsers(request: Request, response: Response) { response.json(await searchUsers(userId(request), String(request.query.q ?? ''))) }
export async function getPublicProfile(request: Request, response: Response) { response.json(await getPublicUser(userId(request), numeric(request.params.userId))) }
export async function postFriendRequest(request: Request, response: Response) { response.status(201).json(await sendFriendRequest(userId(request), numeric(request.params.userId))) }
export async function acceptRequest(request: Request, response: Response) { response.json(await acceptFriendRequest(userId(request), numeric(request.params.requestId))) }
export async function rejectRequest(request: Request, response: Response) { response.json(await rejectFriendRequest(userId(request), numeric(request.params.requestId))) }
export async function cancelRequest(request: Request, response: Response) { response.json(await cancelFriendRequest(userId(request), numeric(request.params.requestId))) }
export async function deleteFriend(request: Request, response: Response) { await removeFriend(userId(request), numeric(request.params.userId)); response.status(204).send() }
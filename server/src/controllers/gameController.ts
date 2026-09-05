import type { Request, Response } from 'express'
import { simulateFight, type ShinobiBuild } from '../game/gameEngine.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { acceptGameInvite, createGameLobby, getGameLobby, listGameInvites, rejectGameInvite, startGameLobby } from '../services/gameLobbyService.js'
import { getGameForLobby } from '../services/realtimeGameService.js'
import { calculateGameResult, chooseGameResult } from '../services/realtimeGameService.js'
import { emitGameState } from '../realtime.js'

export function postSimulation(request: Request, response: Response) {
  const { player1, player2, player3 } = request.body ?? {}
  if (!player1 || !player2 || typeof player1 !== 'object' || typeof player2 !== 'object') {
    response.status(400).json({ error: 'Les compositions des deux joueurs sont requises.' })
    return
  }

  if (player3 !== undefined && (!player3 || typeof player3 !== 'object')) {
    response.status(400).json({ error: 'La composition du troisième joueur est invalide.' })
    return
  }
  const result = simulateFight(player1 as ShinobiBuild, player2 as ShinobiBuild, player3 as ShinobiBuild | undefined)
  response.status(result.player1.validationErrors.length || result.player2.validationErrors.length ? 422 : 200).json({ ...result, resolutionMode: 'simulation' })
}

function userId(request: Request) { return (request as AuthenticatedRequest).userId }
function routeId(value: string | string[] | undefined) { return typeof value === 'string' ? value : '' }

export async function postGameLobby(request: Request, response: Response) { response.status(201).json(await createGameLobby(userId(request), request.body?.mode, request.body?.opponentIds, request.body?.includesAi)) }
export async function getGameInvites(request: Request, response: Response) { response.json(await listGameInvites(userId(request))) }
export async function acceptInvite(request: Request, response: Response) { response.json(await acceptGameInvite(userId(request), routeId(request.params.inviteId))) }
export async function rejectInvite(request: Request, response: Response) { response.json(await rejectGameInvite(userId(request), routeId(request.params.inviteId))) }
export async function getLobby(request: Request, response: Response) { response.json(await getGameLobby(userId(request), routeId(request.params.lobbyId))) }
export async function getLobbyGame(request: Request, response: Response) { response.json(await getGameForLobby(userId(request), routeId(request.params.lobbyId))) }
export async function startLobby(request: Request, response: Response) { response.json(await startGameLobby(userId(request), routeId(request.params.lobbyId))) }
export async function postAutomaticGameResult(request: Request, response: Response) {
  const game = await calculateGameResult(userId(request), routeId(request.params.gameId))
  await emitGameState(routeId(request.params.gameId))
  response.json(game)
}
export async function postManualGameResult(request: Request, response: Response) {
  const game = await chooseGameResult(userId(request), routeId(request.params.gameId), request.body?.winnerNumber, request.body?.isDraw)
  await emitGameState(routeId(request.params.gameId))
  response.json(game)
}
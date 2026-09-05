import { Router } from 'express'
import { acceptInvite, getGameInvites, getLobby, getLobbyGame, postAutomaticGameResult, postGameLobby, postManualGameResult, postSimulation, rejectInvite, startLobby } from '../controllers/gameController.js'
import { requireAuth } from '../middleware/auth.js'

export const gameRoutes = Router()
gameRoutes.post('/simulate', postSimulation)
gameRoutes.use(requireAuth)
gameRoutes.get('/invites', getGameInvites)
gameRoutes.post('/lobbies', postGameLobby)
gameRoutes.post('/invites/:inviteId/accept', acceptInvite)
gameRoutes.post('/invites/:inviteId/reject', rejectInvite)
gameRoutes.post('/games/:gameId/result/auto', postAutomaticGameResult)
gameRoutes.post('/games/:gameId/result/manual', postManualGameResult)
gameRoutes.get('/lobbies/:lobbyId/game', getLobbyGame)
gameRoutes.get('/lobbies/:lobbyId', getLobby)
gameRoutes.post('/lobbies/:lobbyId/start', startLobby)
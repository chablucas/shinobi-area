import { Router } from 'express'
import { acceptInvite, getGameInvites, getLobby, postGameLobby, postSimulation, rejectInvite } from '../controllers/gameController.js'
import { requireAuth } from '../middleware/auth.js'

export const gameRoutes = Router()
gameRoutes.post('/simulate', postSimulation)
gameRoutes.use(requireAuth)
gameRoutes.get('/invites', getGameInvites)
gameRoutes.post('/lobbies', postGameLobby)
gameRoutes.post('/invites/:inviteId/accept', acceptInvite)
gameRoutes.post('/invites/:inviteId/reject', rejectInvite)
gameRoutes.get('/lobbies/:lobbyId', getLobby)
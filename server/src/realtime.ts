import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { requireJwtSecret } from './config/env.js'
import { drawCard, findGame, getGameForUser, placeCard, publicGameState } from './services/realtimeGameService.js'

type SocketData = { userId?: number; gameId?: string }

export function attachRealtime(io: Server) {
  io.use((socket, next) => {
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : ''
    try {
      const payload = jwt.verify(token, requireJwtSecret())
      if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Token invalide')
      const userId = Number(payload.sub)
      if (!Number.isInteger(userId)) throw new Error('Token invalide')
      ;(socket.data as SocketData).userId = userId
      next()
    } catch { next(new Error('Authentification socket invalide.')) }
  })

  async function emitState(gameId: string) {
    const sockets = await io.in(`game:${gameId}`).fetchSockets()
    const game = await findGame(gameId)
    if (!game) return
    for (const socket of sockets) {
      const userId = (socket.data as SocketData).userId
      if (userId) socket.emit('game:state', await publicGameState(game, userId))
    }
  }

  io.on('connection', (socket) => {
    const userId = (socket.data as SocketData).userId
    if (!userId) return
    socket.on('game:join', async (gameId: unknown, acknowledge?: (response: unknown) => void) => {
      try {
        if (typeof gameId !== 'string' || !gameId) throw Object.assign(new Error('Identifiant de partie invalide.'), { statusCode: 400 })
        const state = await getGameForUser(userId, gameId)
        await socket.join(`game:${gameId}`)
        socket.data.gameId = gameId
        socket.emit('game:state', state)
        acknowledge?.({ ok: true })
      } catch (error) {
        socket.emit('game:error', { message: error instanceof Error ? error.message : 'Impossible de rejoindre la partie.' })
        acknowledge?.({ ok: false, message: error instanceof Error ? error.message : 'Impossible de rejoindre la partie.' })
      }
    })
    socket.on('game:request-state', async () => {
      const gameId = socket.data.gameId
      if (typeof gameId !== 'string') return
      try { socket.emit('game:state', await getGameForUser(userId, gameId)) } catch (error) { socket.emit('game:error', { message: error instanceof Error ? error.message : 'État indisponible.' }) }
    })
    socket.on('game:draw', async (gameId: unknown) => {
      if (typeof gameId !== 'string' || socket.data.gameId !== gameId) return socket.emit('game:error', { message: 'Rejoins la partie avant de jouer.' })
      try { await drawCard(userId, gameId); await emitState(gameId) } catch (error) { socket.emit('game:error', { message: error instanceof Error ? error.message : 'Tirage refusé.' }) }
    })
    socket.on('game:place-card', async (payload: { gameId?: unknown; category?: unknown }) => {
      const gameId = payload?.gameId
      if (typeof gameId !== 'string' || socket.data.gameId !== gameId) return socket.emit('game:error', { message: 'Rejoins la partie avant de jouer.' })
      try { await placeCard(userId, gameId, payload.category); await emitState(gameId) } catch (error) { socket.emit('game:error', { message: error instanceof Error ? error.message : 'Placement refusé.' }) }
    })
  })

  return io
}

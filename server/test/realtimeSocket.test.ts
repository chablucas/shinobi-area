import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import { io as connectSocket, type Socket } from 'socket.io-client'
import { Server } from 'socket.io'
import { app } from '../src/app.js'
import { requireJwtSecret } from '../src/config/env.js'
import { prisma } from '../src/config/prisma.js'
import { attachRealtime, emitGameState } from '../src/realtime.js'
import { acceptGameInvite, createGameLobby, startGameLobby } from '../src/services/gameLobbyService.js'
import { calculateGameResult, chooseGameResult, drawCard, GAME_CATEGORIES, getGameForLobby, getGameForUser, placeCard } from '../src/services/realtimeGameService.js'

type State = Awaited<ReturnType<typeof getGameForLobby>>

function tokenFor(userId: number) { return jwt.sign({}, requireJwtSecret(), { subject: String(userId), expiresIn: '1h' }) }

function nextState(socket: Socket, predicate: (state: State) => boolean) {
  return new Promise<State>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('game:state', onState); reject(new Error('État realtime non reçu à temps.')) }, 5000)
    const onState = (state: State) => { if (predicate(state)) { clearTimeout(timer); socket.off('game:state', onState); resolve(state) } }
    socket.on('game:state', onState)
  })
}

function nextError(socket: Socket) {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('game:error', onError); reject(new Error('Erreur realtime non reçue à temps.')) }, 5000)
    const onError = (error: { message: string }) => { clearTimeout(timer); socket.off('game:error', onError); resolve(error.message) }
    socket.on('game:error', onError)
  })
}

// alterne les tours et remplit les catégories vides jusqu'au nombre de tours demandé
async function fillBoards(gameId: string, playerIds: [number, number], rounds: number) {
  let dto = await getGameForUser(playerIds[0], gameId)
  for (let i = 0; i < rounds; i++) {
    const actingId = dto!.currentPlayerNumber === 1 ? playerIds[0] : playerIds[1]
    const drawn = await drawCard(actingId, gameId)
    const me = drawn!.players.find((player) => player.userId === actingId)!
    const category = GAME_CATEGORIES.find((slot) => !me.slots[slot])!
    dto = await placeCard(actingId, gameId, category)
  }
  return dto!
}

test('le transport socket couvre join, draw privé, place et changement de tour', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `socket-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Socket A ${suffix}` },
    { email: `socket-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Socket B ${suffix}` },
  ], select: { id: true } })
  const [creator, opponent] = users
  const httpServer = createServer(app)
  const io = new Server(httpServer, { cors: { origin: true } })
  attachRealtime(io)
  try {
    await new Promise<void>((resolve) => httpServer.listen(0, resolve))
    const address = httpServer.address()
    assert.ok(address && typeof address !== 'string')
    const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
    await startGameLobby(creator!.id, lobby!.id)
    const initial = await getGameForLobby(creator!.id, lobby!.id)
    assert.ok(initial)
    const socketA = connectSocket(`http://localhost:${address.port}`, { auth: { token: tokenFor(creator!.id) } })
    const socketB = connectSocket(`http://localhost:${address.port}`, { auth: { token: tokenFor(opponent!.id) } })
    try {
      await Promise.all([socketA, socketB].map((socket) => new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve())
        socket.once('connect_error', reject)
      })))
      const joinedA = nextState(socketA, (state) => state.id === initial.id)
      const joinedB = nextState(socketB, (state) => state.id === initial.id)
      socketA.emit('game:join', initial.id)
      socketB.emit('game:join', initial.id)
      await Promise.all([joinedA, joinedB])
      const turnBefore = initial.currentPlayerNumber
      const drawA = nextState(socketA, (state) => Boolean(state.players.find((player) => player.userId === creator!.id)?.pendingCard))
      const hiddenB = nextState(socketB, (state) => state.players.every((player) => !player.pendingCard))
      const rejectedDraw = nextError(socketB)
      socketB.emit('game:draw', initial.id)
      assert.match(await rejectedDraw, /tour|carte/i)
      socketA.emit('game:draw', initial.id)
      const [drawnA, drawnB] = await Promise.all([drawA, hiddenB])
      const pending = drawnA.players.find((player) => player.userId === creator!.id)?.pendingCard
      assert.ok(pending)
      assert.equal(drawnA.currentPlayerNumber, turnBefore)
      assert.equal(drawnB.players.find((player) => player.userId === creator!.id)?.pendingCard, null)
      const category = GAME_CATEGORIES.find((slot) => !pending.eligibleSlots.includes(slot))!
      assert.ok(category)
      const placedState = nextState(socketA, (state) => state.currentPlayerNumber !== turnBefore && !state.players.find((player) => player.userId === creator!.id)?.pendingCard)
      socketA.emit('game:place-card', { gameId: initial.id, category })
      const placed = await placedState
      assert.equal(placed.currentPlayerNumber, 2)
      const drawB = nextState(socketB, (state) => Boolean(state.players.find((player) => player.userId === opponent!.id)?.pendingCard))
      socketB.emit('game:draw', initial.id)
      assert.ok((await drawB).players.find((player) => player.userId === opponent!.id)?.pendingCard)
    } finally {
      socketA.disconnect()
      socketB.disconnect()
    }
  } finally {
    io.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('AWAITING_RESULT puis résultat AUTO sont diffusés aux deux joueurs, et la reconnexion après FINISHED renvoie le résultat', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `socket-result-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Result A ${suffix}` },
    { email: `socket-result-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Result B ${suffix}` },
  ], select: { id: true } })
  const [creator, opponent] = users
  const httpServer = createServer(app)
  const io = new Server(httpServer, { cors: { origin: true } })
  attachRealtime(io)
  try {
    await new Promise<void>((resolve) => httpServer.listen(0, resolve))
    const address = httpServer.address()
    assert.ok(address && typeof address !== 'string')
    const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
    await startGameLobby(creator!.id, lobby!.id)
    const initial = await getGameForLobby(creator!.id, lobby!.id)
    assert.ok(initial)
    let socketA = connectSocket(`http://localhost:${address.port}`, { auth: { token: tokenFor(creator!.id) } })
    const socketB = connectSocket(`http://localhost:${address.port}`, { auth: { token: tokenFor(opponent!.id) } })
    try {
      await Promise.all([socketA, socketB].map((socket) => new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve())
        socket.once('connect_error', reject)
      })))
      socketA.emit('game:join', initial.id)
      socketB.emit('game:join', initial.id)
      await Promise.all([nextState(socketA, (state) => state.id === initial.id), nextState(socketB, (state) => state.id === initial.id)])

      const awaitingA = nextState(socketA, (state) => state.status === 'AWAITING_RESULT')
      const awaitingB = nextState(socketB, (state) => state.status === 'AWAITING_RESULT')
      await fillBoards(initial.id, [creator!.id, opponent!.id], GAME_CATEGORIES.length * 2)
      await emitGameState(initial.id)
      const [reachedA, reachedB] = await Promise.all([awaitingA, awaitingB])
      assert.equal(reachedA.status, 'AWAITING_RESULT')
      assert.equal(reachedB.status, 'AWAITING_RESULT')

      const finishedA = nextState(socketA, (state) => state.status === 'FINISHED')
      const finishedB = nextState(socketB, (state) => state.status === 'FINISHED')
      await calculateGameResult(creator!.id, initial.id)
      await emitGameState(initial.id)
      const [autoA, autoB] = await Promise.all([finishedA, finishedB])
      assert.equal((autoA.result as { resultMode: string } | null)?.resultMode, 'AUTO')
      assert.equal((autoB.result as { resultMode: string } | null)?.resultMode, 'AUTO')
      assert.deepEqual(autoA.result, autoB.result)

      socketA.disconnect()
      socketA = connectSocket(`http://localhost:${address.port}`, { auth: { token: tokenFor(creator!.id) } })
      await new Promise<void>((resolve, reject) => { socketA.once('connect', () => resolve()); socketA.once('connect_error', reject) })
      const rejoined = nextState(socketA, (state) => state.status === 'FINISHED')
      socketA.emit('game:join', initial.id)
      const reconnected = await rejoined
      assert.equal(reconnected.status, 'FINISHED')
      assert.ok(reconnected.result)
    } finally {
      socketA.disconnect()
      socketB.disconnect()
    }
  } finally {
    io.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})

test('le résultat MANUAL est diffusé aux deux joueurs via Socket.IO', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `socket-manual-a-${suffix}@example.test`, passwordHash: 'test', displayName: `Manual A ${suffix}` },
    { email: `socket-manual-b-${suffix}@example.test`, passwordHash: 'test', displayName: `Manual B ${suffix}` },
  ], select: { id: true } })
  const [creator, opponent] = users
  const httpServer = createServer(app)
  const io = new Server(httpServer, { cors: { origin: true } })
  attachRealtime(io)
  try {
    await new Promise<void>((resolve) => httpServer.listen(0, resolve))
    const address = httpServer.address()
    assert.ok(address && typeof address !== 'string')
    const lobby = await createGameLobby(creator!.id, '1v1', [opponent!.id])
    await acceptGameInvite(opponent!.id, lobby!.players[1]!.inviteId!)
    await startGameLobby(creator!.id, lobby!.id)
    const initial = await getGameForLobby(creator!.id, lobby!.id)
    assert.ok(initial)
    const socketA = connectSocket(`http://localhost:${address.port}`, { auth: { token: tokenFor(creator!.id) } })
    const socketB = connectSocket(`http://localhost:${address.port}`, { auth: { token: tokenFor(opponent!.id) } })
    try {
      await Promise.all([socketA, socketB].map((socket) => new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve())
        socket.once('connect_error', reject)
      })))
      socketA.emit('game:join', initial.id)
      socketB.emit('game:join', initial.id)
      await Promise.all([nextState(socketA, (state) => state.id === initial.id), nextState(socketB, (state) => state.id === initial.id)])

      await fillBoards(initial.id, [creator!.id, opponent!.id], GAME_CATEGORIES.length * 2)

      const finishedA = nextState(socketA, (state) => state.status === 'FINISHED')
      const finishedB = nextState(socketB, (state) => state.status === 'FINISHED')
      await chooseGameResult(creator!.id, initial.id, 1, false)
      await emitGameState(initial.id)
      const [manualA, manualB] = await Promise.all([finishedA, finishedB])
      const resultA = manualA.result as { resultMode: string; winnerNumber: number | null } | null
      const resultB = manualB.result as { resultMode: string; winnerNumber: number | null } | null
      assert.equal(resultA?.resultMode, 'MANUAL')
      assert.equal(resultA?.winnerNumber, 1)
      assert.deepEqual(resultA, resultB)
    } finally {
      socketA.disconnect()
      socketB.disconnect()
    }
  } finally {
    io.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
  }
})
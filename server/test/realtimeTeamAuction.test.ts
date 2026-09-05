import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { Server as HttpServer } from 'node:http'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import { io as connectSocket, type Socket } from 'socket.io-client'
import { Server } from 'socket.io'
import { app } from '../src/app.js'
import { requireJwtSecret } from '../src/config/env.js'
import { attachRealtime } from '../src/realtime.js'
import { prisma } from '../src/config/prisma.js'

function tokenFor(userId: number) { return jwt.sign({}, requireJwtSecret(), { subject: String(userId), expiresIn: '1h' }) }

type TAState = {
  gameId: string
  phase: string
  mode: string
  currentBid: number
  currentBidderId: number | string | null
  currentTurnId: number | string | null
  winnerId: number | string | null
  finalResults: { teams: Array<{ playerId: number | string; teamNumber: number; score: number; won: boolean }>; winnerId: number | string | null } | null
  currentCard?: { score: number } | null
  players: Array<{ id: number | string; displayName: string; budget: number; passedCurrentRound: boolean }>
}

function nextTAState(socket: Socket, predicate: (state: TAState) => boolean) {
  return new Promise<TAState>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('team-auction:state', onState); reject(new Error('État Team Auction non reçu à temps.')) }, 5000)
    const onState = (state: TAState) => { if (predicate(state)) { clearTimeout(timer); socket.off('team-auction:state', onState); resolve(state) } }
    socket.on('team-auction:state', onState)
  })
}

function nextTAError(socket: Socket) {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('team-auction:error', onError); reject(new Error('Erreur Team Auction non reçue à temps.')) }, 5000)
    const onError = (error: { message: string }) => { clearTimeout(timer); socket.off('team-auction:error', onError); resolve(error.message) }
    socket.on('team-auction:error', onError)
  })
}

function ack<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve))
}

function requestTAState(socket: Socket, gameId: string, predicate: (state: TAState) => boolean) {
  const state = nextTAState(socket, predicate)
  socket.emit('team-auction:request-state', gameId)
  return state
}

function actAndRequestTAState(socket: Socket, gameId: string, payload: { action: string; amount?: number; teamIndex?: number }, predicate: (state: TAState) => boolean) {
  const state = nextTAState(socket, predicate)
  socket.emit('team-auction:action', { gameId, ...payload })
  socket.emit('team-auction:request-state', gameId)
  return state
}

async function startServer(): Promise<{ httpServer: HttpServer; port: number }> {
  const httpServer = createServer(app)
  const io = new Server(httpServer, { cors: { origin: true } })
  attachRealtime(io)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  assert.ok(address && typeof address !== 'string')
  return { httpServer, port: address.port }
}

function connectAndWait(port: number, userId: number) {
  const socket = connectSocket(`http://localhost:${port}`, { auth: { token: tokenFor(userId) } })
  return new Promise<Socket>((resolve, reject) => {
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}

test('création, jointure, refus de salon plein et lancement avec joueurs insuffisants', async () => {
  const { httpServer, port } = await startServer()
  try {
    const [socketA, socketB, socketC] = await Promise.all([90101, 90102, 90103].map((id) => connectAndWait(port, id)))
    try {
      const createResponse = await ack<{ ok: boolean; gameId?: string }>(socketA, 'team-auction:create', { mode: '1v1-real', teamSizes: [1], initialBudget: 500 })
      assert.equal(createResponse.ok, true)
      const gameId = createResponse.gameId!

      const earlyStartError = nextTAError(socketA)
      socketA.emit('team-auction:start', gameId)
      assert.match(await earlyStartError, /joueurs requis/)

      const badJoin = await ack<{ ok: boolean; message?: string }>(socketC, 'team-auction:join', 'salon-inexistant')
      assert.equal(badJoin.ok, false)
      assert.match(badJoin.message ?? '', /introuvable/)

      const bothJoined = nextTAState(socketA, (state) => state.gameId === gameId && state.players.length === 2)
      const joinResponse = await ack<{ ok: boolean }>(socketB, 'team-auction:join', gameId)
      assert.equal(joinResponse.ok, true)
      await bothJoined

      const fullJoin = await ack<{ ok: boolean; message?: string }>(socketC, 'team-auction:join', gameId)
      assert.equal(fullJoin.ok, false)
      assert.match(fullJoin.message ?? '', /plein/)
    } finally { socketA.disconnect(); socketB.disconnect(); socketC.disconnect() }
  } finally { httpServer.close() }
})

test('les états Team Auction exposent les pseudonymes de profil et le score canonique', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const users = await prisma.user.createManyAndReturn({ data: [
    { email: `auction-lucas-${suffix}@example.test`, passwordHash: 'test', displayName: 'Lucas' },
    { email: `auction-boubou-${suffix}@example.test`, passwordHash: 'test', displayName: 'Boubou' },
  ], select: { id: true } })
  const { httpServer, port } = await startServer()
  try {
    const [socketA, socketB] = await Promise.all(users.map((user) => connectAndWait(port, user!.id)))
    try {
      const created = await ack<{ ok: boolean; gameId?: string }>(socketA, 'team-auction:create', { mode: '1v1-real', teamSizes: [1], initialBudget: 500 })
      await ack(socketB, 'team-auction:join', created.gameId!)
      const statePromise = nextTAState(socketA, (state) => state.phase === 'BIDDING' && state.currentCard !== null)
      socketA.emit('team-auction:start', created.gameId)
      const state = await statePromise
      assert.deepEqual(state.players.map((player) => player.displayName), ['Lucas', 'Boubou'])
      assert.ok((state.currentCard?.score ?? 0) > 0)
    } finally { socketA.disconnect(); socketB.disconnect() }
  } finally {
    httpServer.close()
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user!.id) } } })
  }
})

test('bid, pass, placement, diffusion et résultat final sur une partie 1v1 réelle complète', async () => {
  const { httpServer, port } = await startServer()
  try {
    const [socketA, socketB] = await Promise.all([90201, 90202].map((id) => connectAndWait(port, id)))
    try {
      const createResponse = await ack<{ ok: boolean; gameId?: string }>(socketA, 'team-auction:create', { mode: '1v1-real', teamSizes: [1], initialBudget: 500 })
      const gameId = createResponse.gameId!
      await ack(socketB, 'team-auction:join', gameId)

      const biddingRound1 = nextTAState(socketA, (state) => state.phase === 'BIDDING' && state.currentTurnId === 90201)
      socketA.emit('team-auction:start', gameId)
      await biddingRound1

      const afterFirstBid = nextTAState(socketB, (state) => state.currentBid === 10 && state.currentBidderId === 90201)
      socketA.emit('team-auction:action', { gameId, action: 'bid', amount: 10 })
      await afterFirstBid

      const firstPlacement = nextTAState(socketA, (state) => state.phase === 'PLACEMENT' && state.winnerId === 90201)
      socketB.emit('team-auction:action', { gameId, action: 'pass' })
      await firstPlacement

      const biddingRound2 = nextTAState(socketB, (state) => state.phase === 'BIDDING' && state.currentTurnId === 90202)
      socketA.emit('team-auction:action', { gameId, action: 'place', teamIndex: 0 })
      await biddingRound2

      const afterSecondBid = nextTAState(socketA, (state) => state.currentBid === 10 && state.currentBidderId === 90202)
      socketB.emit('team-auction:action', { gameId, action: 'bid', amount: 10 })
      await afterSecondBid

      const secondPlacement = nextTAState(socketB, (state) => state.phase === 'PLACEMENT' && state.winnerId === 90202)
      socketA.emit('team-auction:action', { gameId, action: 'pass' })
      await secondPlacement

      const finalState = nextTAState(socketA, (state) => state.phase === 'RESULTS' && Boolean(state.finalResults))
      socketB.emit('team-auction:action', { gameId, action: 'place', teamIndex: 0 })
      const result = await finalState
      assert.ok(result.finalResults)
    } finally { socketA.disconnect(); socketB.disconnect() }
  } finally { httpServer.close() }
})

test('ALL-IN consomme le budget et attribue immédiatement la carte sans surenchère possible', async () => {
  const { httpServer, port } = await startServer()
  try {
    const [socketA, socketB] = await Promise.all([90301, 90302].map((id) => connectAndWait(port, id)))
    try {
      const createResponse = await ack<{ ok: boolean; gameId?: string }>(socketA, 'team-auction:create', { mode: '1v1-real', teamSizes: [5], initialBudget: 300 })
      const gameId = createResponse.gameId!
      await ack(socketB, 'team-auction:join', gameId)

      const biddingState = nextTAState(socketA, (state) => state.phase === 'BIDDING')
      socketA.emit('team-auction:start', gameId)
      await biddingState

      const placementState = nextTAState(socketB, (state) => state.phase === 'PLACEMENT' && state.currentBid === 300 && state.winnerId === 90301)
      socketA.emit('team-auction:action', { gameId, action: 'allin' })
      const placed = await placementState
      const winner = placed.players.find((player) => player.id === 90301)
      assert.equal(winner?.budget, 0)
    } finally { socketA.disconnect(); socketB.disconnect() }
  } finally { httpServer.close() }
})

test('1v1 IA démarre sans salon et avance via décisions serveur', async () => {
  const { httpServer, port } = await startServer()
  try {
    const socketA = await connectAndWait(port, 90401)
    try {
      const createResponse = await ack<{ ok: boolean; gameId?: string }>(socketA, 'team-auction:create', { mode: '1v1-ai', teamSizes: [1], initialBudget: 500 })
      assert.equal(createResponse.ok, true)
      const requestedState = nextTAState(socketA, (value) => value.gameId === createResponse.gameId && value.mode === '1v1-ai' && ['BIDDING', 'PLACEMENT', 'RESULTS'].includes(value.phase))
      socketA.emit('team-auction:request-state', createResponse.gameId)
      const state = await requestedState
      assert.equal(state.players.length, 2)
      assert.ok(state.players.some((player) => String(player.id).startsWith('ai-')))
    } finally { socketA.disconnect() }
  } finally { httpServer.close() }
})

test('1v1v1 réel diffuse rotation, PASS et résultats à trois joueurs', async () => {
  const { httpServer, port } = await startServer()
  try {
    const [socketA, socketB, socketC] = await Promise.all([90501, 90502, 90503].map((id) => connectAndWait(port, id)))
    try {
      const createResponse = await ack<{ ok: boolean; gameId?: string }>(socketA, 'team-auction:create', { mode: '1v1v1-real', teamSizes: [1], initialBudget: 500 })
      const gameId = createResponse.gameId!
      await ack(socketB, 'team-auction:join', gameId)
      await ack(socketC, 'team-auction:join', gameId)

      socketA.emit('team-auction:start', gameId)
      await requestTAState(socketA, gameId, (state) => state.phase === 'BIDDING' && state.currentTurnId === 90501 && state.players.length === 3)

      await actAndRequestTAState(socketA, gameId, { action: 'bid', amount: 10 }, (state) => state.currentBid === 10 && state.currentTurnId === 90502)

      await actAndRequestTAState(socketB, gameId, { action: 'pass' }, (state) => state.currentTurnId === 90503 && Boolean(state.players.find((player) => player.id === 90502)?.passedCurrentRound))

      await actAndRequestTAState(socketC, gameId, { action: 'pass' }, (state) => state.phase === 'PLACEMENT' && state.winnerId === 90501)

      await actAndRequestTAState(socketA, gameId, { action: 'place', teamIndex: 0 }, (state) => state.phase === 'BIDDING' && state.currentTurnId === 90502)

      await actAndRequestTAState(socketB, gameId, { action: 'pass' }, (state) => state.phase === 'BIDDING' && state.currentTurnId === 90503 && Boolean(state.players.find((player) => player.id === 90502)?.passedCurrentRound))

      await actAndRequestTAState(socketC, gameId, { action: 'bid', amount: 10 }, (state) => state.phase === 'BIDDING' && state.currentTurnId === 90501 && state.currentBidderId === 90503)
      await actAndRequestTAState(socketA, gameId, { action: 'pass' }, (state) => state.phase === 'PLACEMENT' && state.winnerId === 90503)

      await actAndRequestTAState(socketC, gameId, { action: 'place', teamIndex: 0 }, (state) => state.phase === 'BIDDING' && state.currentTurnId === 90503)

      await actAndRequestTAState(socketC, gameId, { action: 'pass' }, (state) => state.phase === 'BIDDING' && state.currentTurnId === 90501 && Boolean(state.players.find((player) => player.id === 90503)?.passedCurrentRound))
      await actAndRequestTAState(socketA, gameId, { action: 'pass' }, (state) => state.phase === 'BIDDING' && state.currentTurnId === 90502 && Boolean(state.players.find((player) => player.id === 90501)?.passedCurrentRound))
      await actAndRequestTAState(socketB, gameId, { action: 'bid', amount: 10 }, (state) => state.phase === 'PLACEMENT' && state.winnerId === 90502)
      const result = await actAndRequestTAState(socketB, gameId, { action: 'place', teamIndex: 0 }, (state) => state.phase === 'RESULTS' && (state.finalResults?.teams.length ?? 0) === 3)
      assert.equal(result.finalResults?.teams.length, 3)
      assert.ok(result.finalResults?.winnerId === null || [90501, 90502, 90503].includes(Number(result.finalResults?.winnerId)))
    } finally { socketA.disconnect(); socketB.disconnect(); socketC.disconnect() }
  } finally { httpServer.close() }
})

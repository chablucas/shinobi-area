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
import { acceptGameInvite, createGameLobby } from '../src/services/gameLobbyService.js'

type LobbyState = {
  gameId: string
  phase: string
  hostId: number | null
  expectedPlayers: number
  playerCount: number
  canStart: boolean
  players: Array<{ id: number | string; displayName: string; isAi: boolean }>
}

function tokenFor(userId: number) { return jwt.sign({}, requireJwtSecret(), { subject: String(userId), expiresIn: '1h' }) }

function nextState(socket: Socket, predicate: (state: LobbyState) => boolean) {
  return new Promise<LobbyState>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('team-auction:state', onState); reject(new Error('État Team Auction non reçu à temps.')) }, 5000)
    const onState = (state: LobbyState) => { if (predicate(state)) { clearTimeout(timer); socket.off('team-auction:state', onState); resolve(state) } }
    socket.on('team-auction:state', onState)
  })
}

function nextError(socket: Socket) {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('team-auction:error', onError); reject(new Error('Erreur Team Auction non reçue à temps.')) }, 5000)
    const onError = (error: { message: string }) => { clearTimeout(timer); socket.off('team-auction:error', onError); resolve(error.message) }
    socket.on('team-auction:error', onError)
  })
}

function ack<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve))
}

async function startServer(): Promise<{ httpServer: HttpServer; io: Server; port: number }> {
  const httpServer = createServer(app)
  const io = new Server(httpServer, { cors: { origin: true } })
  attachRealtime(io)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  assert.ok(address && typeof address !== 'string')
  return { httpServer, io, port: address.port }
}

async function closeTestServer(io: Server, httpServer: HttpServer) {
  try {
    await new Promise<void>((resolve, reject) => io.close((error) => error ? reject(error) : resolve()))
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code !== 'ERR_SERVER_NOT_RUNNING') throw error
  }

  if (httpServer.listening) {
    await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()))
  }
}

function connectAndWait(port: number, userId: number) {
  const socket = connectSocket(`http://localhost:${port}`, { auth: { token: tokenFor(userId) } })
  return new Promise<Socket>((resolve, reject) => {
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}

async function createUsers(names: string[]) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return prisma.user.createManyAndReturn({
    data: names.map((displayName, index) => ({ email: `ta-lobby-${index}-${suffix}@example.test`, passwordHash: 'test', displayName })),
    select: { id: true, displayName: true },
  })
}

test('le lobby 1v1 passe de 1/2 à 2/2 et l’hôte reçoit l’état mis à jour', async () => {
  const [host, guest] = await createUsers(['Chabou', 'Boubou'])
  const { httpServer, io, port } = await startServer()
  try {
    const [socketA, socketB] = await Promise.all([host!.id, guest!.id].map((id) => connectAndWait(port, id)))
    try {
      const created = await ack<{ ok: boolean; gameId?: string }>(socketA, 'team-auction:create', { mode: '1v1-real', teamSizes: [1], initialBudget: 500 })
      const gameId = created.gameId!

      const lobbyAlonePromise = nextState(socketA, (state) => state.gameId === gameId)
      socketA.emit('team-auction:request-state', gameId)
      const lobbyAlone = await lobbyAlonePromise
      assert.equal(lobbyAlone.playerCount, 1)
      assert.equal(lobbyAlone.expectedPlayers, 2)
      assert.equal(lobbyAlone.canStart, false)
      assert.equal(lobbyAlone.hostId, host!.id)

      const startTooEarly = nextError(socketA)
      socketA.emit('team-auction:start', gameId)
      assert.match(await startTooEarly, /joueurs requis/)

      const hostSeesGuest = nextState(socketA, (state) => state.playerCount === 2)
      const guestSeesLobby = nextState(socketB, (state) => state.playerCount === 2)
      assert.equal((await ack<{ ok: boolean }>(socketB, 'team-auction:join', gameId)).ok, true)

      const hostState = await hostSeesGuest
      assert.equal(hostState.canStart, true)
      assert.deepEqual(hostState.players.map((player) => player.displayName), ['Chabou', 'Boubou'])

      const guestState = await guestSeesLobby
      assert.equal(guestState.hostId, host!.id)
      assert.deepEqual(guestState.players.map((player) => player.displayName), ['Chabou', 'Boubou'])

      const started = nextState(socketA, (state) => state.phase !== 'LOBBY')
      socketA.emit('team-auction:start', gameId)
      await started
    } finally { socketA.disconnect(); socketB.disconnect() }
  } finally {
    await closeTestServer(io, httpServer)
  }
})

test('une reconnexion ne duplique pas le participant du lobby', async () => {
  const [host, guest] = await createUsers(['Chabou', 'Boubou'])
  const { httpServer, io, port } = await startServer()
  try {
    const socketA = await connectAndWait(port, host!.id)
    let socketB = await connectAndWait(port, guest!.id)
    try {
      const created = await ack<{ ok: boolean; gameId?: string }>(socketA, 'team-auction:create', { mode: '1v1-real', teamSizes: [1], initialBudget: 500 })
      const gameId = created.gameId!
      await ack(socketB, 'team-auction:join', gameId)

      socketB.disconnect()
      socketB = await connectAndWait(port, guest!.id)
      const reconnected = nextState(socketB, (state) => state.gameId === gameId)
      socketB.emit('team-auction:request-state', gameId)
      const state = await reconnected

      assert.equal(state.playerCount, 2)
      assert.equal(state.players.length, 2)
      assert.equal(state.canStart, true)
    } finally { socketA.disconnect(); socketB.disconnect() }
  } finally {
    await closeTestServer(io, httpServer)
  }
})

test('un invité reconnecté après le lancement retrouve la même partie et ne peut pas la relancer', async () => {
  const [host, guest] = await createUsers(['Chabou', 'Boubou'])
  const lobby = await createGameLobby(host!.id, 'team-1v1', [guest!.id])
  await acceptGameInvite(guest!.id, lobby!.players[1]!.inviteId!)
  const { httpServer, io, port } = await startServer()
  try {
    const socketA = await connectAndWait(port, host!.id)
    let socketB = await connectAndWait(port, guest!.id)
    try {
      // Les deux entrent dans le salon AVANT le lancement (même gameId, aucun nouveau salon)
      const hostLobby = nextState(socketA, (state) => state.gameId === lobby!.id)
      socketA.emit('team-auction:request-state', lobby!.id)
      assert.equal((await hostLobby).playerCount, 2)

      const guestLobby = nextState(socketB, (state) => state.gameId === lobby!.id)
      socketB.emit('team-auction:request-state', lobby!.id)
      assert.equal((await guestLobby).playerCount, 2)

      // L'invité ne peut pas démarrer la partie
      const guestStartRefused = nextError(socketB)
      socketB.emit('team-auction:start', lobby!.id)
      assert.match(await guestStartRefused, /hôte/)

      // L'hôte lance: les deux reçoivent le nouvel état dans la même room
      const hostStarted = nextState(socketA, (state) => state.phase !== 'LOBBY')
      const guestStarted = nextState(socketB, (state) => state.phase !== 'LOBBY')
      socketA.emit('team-auction:start', lobby!.id)
      const [hostState, guestState] = await Promise.all([hostStarted, guestStarted])
      assert.equal(hostState.gameId, lobby!.id)
      assert.equal(guestState.gameId, lobby!.id)

      // Reconnexion de l'invité après le lancement: même gameId, même phase, aucune recréation
      socketB.disconnect()
      socketB = await connectAndWait(port, guest!.id)
      const reconnected = nextState(socketB, (state) => state.gameId === lobby!.id)
      socketB.emit('team-auction:request-state', lobby!.id)
      const resumed = await reconnected
      assert.equal(resumed.gameId, lobby!.id)
      assert.equal(resumed.phase, hostState.phase)
      assert.equal(resumed.playerCount, 2)
    } finally { socketA.disconnect(); socketB.disconnect() }
  } finally {
    await closeTestServer(io, httpServer)
  }
})

test('un salon 1v1v1 atteint 3/3 avant de pouvoir démarrer', async () => {
  const [host, guest, third] = await createUsers(['Chabou', 'Boubou', 'Lucas'])
  const { httpServer, io, port } = await startServer()
  try {
    const [socketA, socketB, socketC] = await Promise.all([host!.id, guest!.id, third!.id].map((id) => connectAndWait(port, id)))
    try {
      const created = await ack<{ ok: boolean; gameId?: string }>(socketA, 'team-auction:create', { mode: '1v1v1-real', teamSizes: [1], initialBudget: 500 })
      const gameId = created.gameId!

      const twoOfThree = nextState(socketA, (state) => state.playerCount === 2)
      await ack(socketB, 'team-auction:join', gameId)
      assert.equal((await twoOfThree).canStart, false)

      const full = nextState(socketA, (state) => state.playerCount === 3)
      await ack(socketC, 'team-auction:join', gameId)
      const state = await full
      assert.equal(state.expectedPlayers, 3)
      assert.equal(state.canStart, true)
      assert.deepEqual(state.players.map((player) => player.displayName), ['Chabou', 'Boubou', 'Lucas'])
    } finally { socketA.disconnect(); socketB.disconnect(); socketC.disconnect() }
  } finally {
    await closeTestServer(io, httpServer)
  }
})

test('l’invitation acceptée propage immédiatement le participant à l’hôte', async () => {
  const [host, guest] = await createUsers(['Chabou', 'Boubou'])
  const lobby = await createGameLobby(host!.id, 'team-1v1', [guest!.id])
  const { httpServer, io, port } = await startServer()
  try {
    const [socketA, socketB] = await Promise.all([host!.id, guest!.id].map((id) => connectAndWait(port, id)))
    try {
      const hostAlone = nextState(socketA, (state) => state.gameId === lobby!.id)
      socketA.emit('team-auction:request-state', lobby!.id)
      const aloneState = await hostAlone
      assert.equal(aloneState.playerCount, 1)
      assert.equal(aloneState.canStart, false)

      await acceptGameInvite(guest!.id, lobby!.players[1]!.inviteId!)

      const state = await nextState(socketA, (value) => value.playerCount === 2)

      assert.equal(state.canStart, true)
      assert.deepEqual(state.players.map((player) => player.displayName), ['Chabou', 'Boubou'])
    } finally { socketA.disconnect(); socketB.disconnect() }
  } finally {
    await closeTestServer(io, httpServer)
  }
})

test('un joueur étranger ne peut pas entrer dans un salon issu d’une invitation', async () => {
  const [host, guest, outsider] = await createUsers(['Chabou', 'Boubou', 'Intrus'])
  const lobby = await createGameLobby(host!.id, 'team-1v1', [guest!.id])
  const { httpServer, io, port } = await startServer()
  try {
    const [socketA, socketC] = await Promise.all([host!.id, outsider!.id].map((id) => connectAndWait(port, id)))
    try {
      const hostReady = nextState(socketA, (state) => state.gameId === lobby!.id)
      socketA.emit('team-auction:request-state', lobby!.id)
      await hostReady

      const refused = await ack<{ ok: boolean; message?: string }>(socketC, 'team-auction:join', lobby!.id)
      assert.equal(refused.ok, false)
      assert.match(refused.message ?? '', /participes pas|introuvable/)
    } finally { socketA.disconnect(); socketC.disconnect() }
  } finally {
    await closeTestServer(io, httpServer)
  }
})

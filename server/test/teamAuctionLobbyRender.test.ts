import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../src/config/prisma.js'
import { acceptGameInvite, createGameLobby, getGameLobby } from '../src/services/gameLobbyService.js'
import { isTeamAuctionMode, teamAuctionGameRoute } from '../../client/src/services/teamAuctionMode.js'
import type { GameLobby } from '../../client/src/services/socialApi.js'

// Réplique EXACTE des computed du template Lobby.vue pour l'invité.
function isHost(lobby: GameLobby, userId: number) { return lobby.creatorId === userId }
function isAcceptedParticipant(lobby: GameLobby, userId: number) {
  return lobby.players.some((player) => player.id === userId && player.status === 'ACCEPTED')
}
function guestCanJoin(lobby: GameLobby, userId: number) {
  return isTeamAuctionMode(lobby.mode) && !isHost(lobby, userId) && isAcceptedParticipant(lobby, userId) && (lobby.status === 'READY' || lobby.status === 'PLAYING')
}

async function createUsers(names: string[]) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return prisma.user.createManyAndReturn({
    data: names.map((displayName, index) => ({ email: `ta-render-${index}-${suffix}@example.test`, passwordHash: 'test', displayName })),
    select: { id: true, displayName: true },
  })
}

test('E2E invité Team Auction 1v1 READY: le bouton REJOINDRE LA PARTIE est visible et navigue vers le même gameId', async () => {
  const [host, guest] = await createUsers(['Chabou', 'Lucas'])
  try {
    const created = await createGameLobby(host!.id, 'team-1v1', [guest!.id])
    await acceptGameInvite(guest!.id, created!.players[1]!.inviteId!)

    // Ce que l'invité reçoit réellement quand il ouvre /lobby/:id
    const lobby = (await getGameLobby(guest!.id, created!.id))!

    // Preuve des valeurs réelles renvoyées par le serveur
    assert.equal(lobby.mode, 'team-1v1')
    assert.equal(lobby.status, 'READY')
    assert.equal(lobby.canStart, true)
    assert.equal(isHost(lobby, guest!.id), false)
    assert.equal(isAcceptedParticipant(lobby, guest!.id), true)

    // Preuve que le bouton est visible (condition exacte du template)
    assert.equal(guestCanJoin(lobby, guest!.id), true)

    // Preuve de la navigation déclenchée par le clic: même gameId, route /team-game
    const target = teamAuctionGameRoute(lobby.mode, lobby.id)
    assert.equal(target.path, '/team-game')
    assert.equal(target.query.gameId, created!.id)
    assert.equal(target.query.mode, '1v1-real')

    // Le host, lui, voit LANCER LA PARTIE (pas REJOINDRE)
    const hostLobby = (await getGameLobby(host!.id, created!.id))!
    assert.equal(isHost(hostLobby, host!.id), true)
    assert.equal(guestCanJoin(hostLobby, host!.id), false)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [host!.id, guest!.id] } } })
  }
})

test('E2E invité Team Auction 1v1 PLAYING: REJOINDRE LA PARTIE reste disponible (reconnexion)', async () => {
  const [host, guest] = await createUsers(['Chabou', 'Lucas'])
  try {
    const created = await createGameLobby(host!.id, 'team-1v1', [guest!.id])
    await acceptGameInvite(guest!.id, created!.players[1]!.inviteId!)
    await prisma.gameLobby.update({ where: { id: created!.id }, data: { status: 'PLAYING' } })

    // L'invité revient (refresh/reconnexion) alors que la partie est lancée
    const lobby = (await getGameLobby(guest!.id, created!.id))!
    assert.equal(lobby.status, 'PLAYING')
    assert.equal(guestCanJoin(lobby, guest!.id), true)

    const target = teamAuctionGameRoute(lobby.mode, lobby.id)
    assert.equal(target.query.gameId, created!.id)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [host!.id, guest!.id] } } })
  }
})

test('E2E Team Auction 1v1v1: les deux invités voient REJOINDRE LA PARTIE vers le même gameId, seul le host voit LANCER', async () => {
  const [host, guestB, guestC] = await createUsers(['A', 'B', 'C'])
  try {
    const created = await createGameLobby(host!.id, 'team-1v1v1', [guestB!.id, guestC!.id])
    await acceptGameInvite(guestB!.id, created!.players[1]!.inviteId!)
    await acceptGameInvite(guestC!.id, created!.players[2]!.inviteId!)

    const lobbyB = (await getGameLobby(guestB!.id, created!.id))!
    const lobbyC = (await getGameLobby(guestC!.id, created!.id))!
    assert.equal(lobbyB.mode, 'team-1v1v1')
    assert.equal(lobbyB.status, 'READY')

    assert.equal(guestCanJoin(lobbyB, guestB!.id), true)
    assert.equal(guestCanJoin(lobbyC, guestC!.id), true)

    // Même gameId pour les deux invités
    assert.equal(teamAuctionGameRoute(lobbyB.mode, lobbyB.id).query.gameId, created!.id)
    assert.equal(teamAuctionGameRoute(lobbyC.mode, lobbyC.id).query.gameId, created!.id)
    assert.equal(teamAuctionGameRoute(lobbyB.mode, lobbyB.id).query.mode, '1v1v1-real')

    // Seul le host ne voit pas REJOINDRE (il voit LANCER)
    const lobbyA = (await getGameLobby(host!.id, created!.id))!
    assert.equal(isHost(lobbyA, host!.id), true)
    assert.equal(guestCanJoin(lobbyA, host!.id), false)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [host!.id, guestB!.id, guestC!.id] } } })
  }
})

test('E2E lobby classique: REJOINDRE LA PARTIE Team Auction ne s’affiche jamais', async () => {
  const [host, guest] = await createUsers(['Chabou', 'Lucas'])
  try {
    const created = await createGameLobby(host!.id, '1v1', [guest!.id])
    await acceptGameInvite(guest!.id, created!.players[1]!.inviteId!)
    const lobby = (await getGameLobby(guest!.id, created!.id))!
    assert.equal(lobby.mode, '1v1')
    assert.equal(isTeamAuctionMode(lobby.mode), false)
    assert.equal(guestCanJoin(lobby, guest!.id), false)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [host!.id, guest!.id] } } })
  }
})

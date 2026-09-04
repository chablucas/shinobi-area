import { GameInviteStatus, GameLobbyStatus, GameMode } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { createOrGetGame } from './realtimeGameService.js'

const userSelect = { id: true, displayName: true } as const

function invalid(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode })
}

function modeOf(mode: unknown) {
  if (mode === '1v1') return GameMode.ONE_V_ONE
  if (mode === '1v1v1') return GameMode.ONE_V_ONE_V_THREE
  throw invalid('Mode de combat invalide.')
}

function publicUser(user: { id: number; displayName: string }) {
  return { id: user.id, displayName: user.displayName, avatarUrl: null }
}

function lobbyInclude() {
  return { creator: { select: userSelect }, invites: { include: { invitee: { select: userSelect } }, orderBy: { createdAt: 'asc' as const } } }
}

const AI_PLAYER = { id: null, displayName: 'IA Shinobi Area', avatarUrl: null, status: 'ACCEPTED', inviteId: null, isAi: true } as const

function formatLobby(lobby: Awaited<ReturnType<typeof findLobby>>) {
  if (!lobby) return null
  return {
    id: lobby.id,
    mode: lobby.mode === GameMode.ONE_V_ONE ? '1v1' : '1v1v1',
    creatorId: lobby.creatorId,
    status: lobby.status,
    includesAi: lobby.includesAi,
    createdAt: lobby.createdAt,
    updatedAt: lobby.updatedAt,
    players: [
      { ...publicUser(lobby.creator), status: 'ACCEPTED', inviteId: null, isAi: false },
      ...lobby.invites.map((invite) => ({ ...publicUser(invite.invitee), status: invite.status, inviteId: invite.id, isAi: false })),
      ...(lobby.includesAi ? [AI_PLAYER] : []),
    ],
  }
}

async function findLobby(id: string) {
  return prisma.gameLobby.findUnique({ where: { id }, include: lobbyInclude() })
}

export async function createGameLobby(creatorId: number, mode: unknown, opponentIds: unknown, includesAi: unknown = false) {
  const gameMode = modeOf(mode)
  const wantsAi = includesAi === true
  if (wantsAi && gameMode !== GameMode.ONE_V_ONE_V_THREE) throw invalid('L’IA ne peut compléter que le mode 1v1v1.')
  const requiredOpponents = gameMode === GameMode.ONE_V_ONE ? 1 : wantsAi ? 1 : 2
  if (!Array.isArray(opponentIds) || opponentIds.length !== requiredOpponents) throw invalid('Le nombre d’adversaires ne correspond pas au mode.')
  const ids = opponentIds.map(Number)
  if (ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length || ids.includes(creatorId)) throw invalid('Les adversaires doivent être distincts et différents du créateur.')
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: userSelect })
  if (users.length !== ids.length) throw invalid('Un adversaire est introuvable.', 404)
  const duplicate = await prisma.gameLobby.findFirst({ where: { creatorId, status: { in: [GameLobbyStatus.WAITING, GameLobbyStatus.READY] }, invites: { some: { inviteeId: { in: ids }, status: GameInviteStatus.PENDING } } } })
  if (duplicate) throw invalid('Une invitation est déjà en attente pour cet adversaire.', 409)
  const lobby = await prisma.gameLobby.create({ data: { creatorId, mode: gameMode, includesAi: wantsAi, invites: { create: ids.map((inviteeId) => ({ inviteeId })) } }, include: lobbyInclude() })
  return formatLobby(lobby)
}

export async function listGameInvites(userId: number) {
  const invites = await prisma.gameInvite.findMany({ where: { inviteeId: userId, status: GameInviteStatus.PENDING }, include: { lobby: { include: { creator: { select: userSelect } } } }, orderBy: { createdAt: 'desc' } })
  return invites.map((invite) => ({ id: invite.id, lobbyId: invite.lobbyId, mode: invite.lobby.mode === GameMode.ONE_V_ONE ? '1v1' : '1v1v1', status: invite.status, createdAt: invite.createdAt, creator: publicUser(invite.lobby.creator) }))
}

async function pendingInvite(userId: number, inviteId: string) {
  const invite = await prisma.gameInvite.findUnique({ where: { id: inviteId } })
  if (!invite || invite.inviteeId !== userId || invite.status !== GameInviteStatus.PENDING) throw invalid('Invitation de combat introuvable.', 404)
  return invite
}

async function updateInvite(userId: number, inviteId: string, status: GameInviteStatus) {
  const invite = await pendingInvite(userId, inviteId)
  await prisma.$transaction(async (transaction) => {
    await transaction.gameInvite.update({ where: { id: invite.id }, data: { status } })
    if (status === GameInviteStatus.ACCEPTED) {
      const remaining = await transaction.gameInvite.count({ where: { lobbyId: invite.lobbyId, status: GameInviteStatus.PENDING } })
      if (remaining === 0) await transaction.gameLobby.update({ where: { id: invite.lobbyId }, data: { status: GameLobbyStatus.READY } })
    }
  })
  const updatedLobby = await findLobby(invite.lobbyId)
  return formatLobby(updatedLobby)
}

export function acceptGameInvite(userId: number, inviteId: string) { return updateInvite(userId, inviteId, GameInviteStatus.ACCEPTED) }
export function rejectGameInvite(userId: number, inviteId: string) { return updateInvite(userId, inviteId, GameInviteStatus.REJECTED) }

export async function getGameLobby(userId: number, lobbyId: string) {
  const lobby = await findLobby(lobbyId)
  if (!lobby) throw invalid('Salon introuvable.', 404)
  if (lobby.creatorId !== userId && !lobby.invites.some((invite) => invite.inviteeId === userId && invite.status === GameInviteStatus.ACCEPTED)) throw invalid('Vous ne participez pas à ce salon.', 403)
  return formatLobby(lobby)
}

export async function startGameLobby(userId: number, lobbyId: string) {
  try {
    const alreadyPlaying = await prisma.gameLobby.findUnique({ where: { id: lobbyId }, select: { creatorId: true, status: true } })
    if (alreadyPlaying?.status === GameLobbyStatus.PLAYING) {
      if (alreadyPlaying.creatorId !== userId) throw invalid('Seul le créateur peut démarrer ce salon.', 403)
      const game = await createOrGetGame(lobbyId)
      const lobby = await findLobby(lobbyId)
      return { lobby: formatLobby(lobby)!, game: { id: game.id, lobbyId: game.lobbyId, mode: game.mode === GameMode.ONE_V_ONE ? '1v1' : '1v1v1', status: game.status } }
    }

    const started = await prisma.$transaction(async (transaction) => {
      const lobby = await transaction.gameLobby.findUnique({ where: { id: lobbyId }, select: { creatorId: true, status: true } })
      if (!lobby) throw invalid('Salon introuvable.', 404)
      if (lobby.creatorId !== userId) throw invalid('Seul le créateur peut démarrer ce salon.', 403)
      if (lobby.status === GameLobbyStatus.PLAYING) throw invalid('Le salon a déjà été démarré.', 409)
      if (lobby.status !== GameLobbyStatus.READY) throw invalid('Le salon n’est pas prêt.', 409)
      const updated = await transaction.gameLobby.update({ where: { id: lobbyId }, data: { status: GameLobbyStatus.PLAYING }, include: lobbyInclude() })
      return { lobby: { ...formatLobby(updated), status: GameLobbyStatus.PLAYING } }
    })

    const game = await createOrGetGame(lobbyId)
    return { lobby: started.lobby, game: { id: game.id, lobbyId: game.lobbyId, mode: game.mode === GameMode.ONE_V_ONE ? '1v1' : '1v1v1', status: game.status } }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') throw invalid('Le salon a déjà été démarré.', 409)
    throw error
  }
}
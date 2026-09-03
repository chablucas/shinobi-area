import { FriendshipStatus } from '@prisma/client'
import { prisma } from '../config/prisma.js'

const publicUserSelect = { id: true, displayName: true } as const

function pair(userId: number, otherUserId: number) {
  return userId < otherUserId ? { userAId: userId, userBId: otherUserId } : { userAId: otherUserId, userBId: userId }
}

function publicUser(user: { id: number; displayName: string }) {
  return { id: user.id, displayName: user.displayName, avatarUrl: null }
}

function assertOtherUser(userId: number, otherUserId: number) {
  if (!Number.isInteger(otherUserId) || otherUserId <= 0 || userId === otherUserId) {
    throw Object.assign(new Error('Un autre utilisateur valide est requis.'), { statusCode: 400 })
  }
}

async function findRelation(userId: number, otherUserId: number) {
  return prisma.friendship.findUnique({ where: { userAId_userBId: pair(userId, otherUserId) } })
}

export async function searchUsers(userId: number, query: string) {
  const term = query.trim()
  if (!term) return []
  const users = await prisma.user.findMany({ where: { id: { not: userId }, displayName: { contains: term, mode: 'insensitive' } }, select: publicUserSelect, orderBy: { displayName: 'asc' }, take: 20 })
  return Promise.all(users.map(async (user) => {
    const relation = await findRelation(userId, user.id)
    return { ...publicUser(user), friendshipStatus: relation?.status ?? null, friendshipDirection: relation?.senderId === userId ? 'sent' : relation ? 'received' : null }
  }))
}

export async function listFriends(userId: number) {
  const relations = await prisma.friendship.findMany({ where: { status: FriendshipStatus.ACCEPTED, OR: [{ userAId: userId }, { userBId: userId }] }, include: { userA: { select: publicUserSelect }, userB: { select: publicUserSelect } }, orderBy: { updatedAt: 'desc' } })
  return relations.map((relation) => publicUser(relation.userAId === userId ? relation.userB : relation.userA))
}

export async function listFriendRequests(userId: number, direction: 'received' | 'sent') {
  const where = direction === 'received' ? { receiverId: userId, status: FriendshipStatus.PENDING } : { senderId: userId, status: FriendshipStatus.PENDING }
  const relations = await prisma.friendship.findMany({ where, include: { sender: { select: publicUserSelect }, receiver: { select: publicUserSelect } }, orderBy: { createdAt: 'desc' } })
  return relations.map((relation) => ({ id: relation.id, status: relation.status, createdAt: relation.createdAt, sender: publicUser(relation.sender), receiver: publicUser(relation.receiver) }))
}

export async function sendFriendRequest(userId: number, otherUserId: number) {
  assertOtherUser(userId, otherUserId)
  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: publicUserSelect })
  if (!otherUser) throw Object.assign(new Error('Utilisateur introuvable.'), { statusCode: 404 })
  const relation = await findRelation(userId, otherUserId)
  if (relation?.status === FriendshipStatus.ACCEPTED) throw Object.assign(new Error('Vous êtes déjà amis.'), { statusCode: 409 })
  if (relation?.status === FriendshipStatus.PENDING) throw Object.assign(new Error('Une demande est déjà en attente.'), { statusCode: 409 })
  const data = { ...pair(userId, otherUserId), senderId: userId, receiverId: otherUserId, status: FriendshipStatus.PENDING }
  const saved = relation ? await prisma.friendship.update({ where: { id: relation.id }, data: { ...data, createdAt: new Date() } }) : await prisma.friendship.create({ data })
  return { id: saved.id, status: saved.status, receiver: publicUser(otherUser) }
}

async function pendingRequest(userId: number, requestId: number) {
  const relation = await prisma.friendship.findUnique({ where: { id: requestId } })
  if (!relation || relation.receiverId !== userId || relation.status !== FriendshipStatus.PENDING) throw Object.assign(new Error('Demande d’ami introuvable.'), { statusCode: 404 })
  return relation
}

export async function acceptFriendRequest(userId: number, requestId: number) {
  const relation = await pendingRequest(userId, requestId)
  return prisma.friendship.update({ where: { id: relation.id }, data: { status: FriendshipStatus.ACCEPTED } })
}

export async function rejectFriendRequest(userId: number, requestId: number) {
  const relation = await pendingRequest(userId, requestId)
  return prisma.friendship.update({ where: { id: relation.id }, data: { status: FriendshipStatus.REJECTED } })
}

export async function cancelFriendRequest(userId: number, requestId: number) {
  const relation = await prisma.friendship.findUnique({ where: { id: requestId } })
  if (!relation || relation.senderId !== userId || relation.status !== FriendshipStatus.PENDING) throw Object.assign(new Error('Demande d’ami introuvable.'), { statusCode: 404 })
  return prisma.friendship.update({ where: { id: relation.id }, data: { status: FriendshipStatus.CANCELLED } })
}

export async function removeFriend(userId: number, otherUserId: number) {
  assertOtherUser(userId, otherUserId)
  const relation = await findRelation(userId, otherUserId)
  if (!relation || relation.status !== FriendshipStatus.ACCEPTED) throw Object.assign(new Error('Amitié introuvable.'), { statusCode: 404 })
  await prisma.friendship.delete({ where: { id: relation.id } })
}
import { Router } from 'express'
import { getPublicProfile, recordGameResult, updateProfile } from '../controllers/userController.js'
import { requireAuth } from '../middleware/auth.js'

export const userRoutes = Router()
userRoutes.patch('/me', requireAuth, updateProfile)
userRoutes.post('/me/results', requireAuth, recordGameResult)
userRoutes.get('/:userId', requireAuth, getPublicProfile)

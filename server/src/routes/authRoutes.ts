import { Router } from 'express'
import { currentUser, loginUser, registerUser } from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'

export const authRoutes = Router()
authRoutes.post('/register', registerUser)
authRoutes.post('/login', loginUser)
authRoutes.get('/me', requireAuth, currentUser)

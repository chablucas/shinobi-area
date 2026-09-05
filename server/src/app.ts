import express from 'express'
import cors from 'cors'
import { env, isAllowedOrigin } from './config/env.js'
import { cardRoutes } from './routes/cardRoutes.js'
import { categoryRoutes } from './routes/categoryRoutes.js'
import { authRoutes } from './routes/authRoutes.js'
import { userRoutes } from './routes/userRoutes.js'
import { buildRoutes } from './routes/buildRoutes.js'
import { gameRoutes } from './routes/gameRoutes.js'
import { friendshipRoutes } from './routes/friendshipRoutes.js'
import { searchRoutes } from './routes/searchRoutes.js'
import { cardAdminRoutes } from './routes/cardAdminRoutes.js'
import { adminRoutes } from './routes/adminRoutes.js'
import { errorHandler, notFound } from './utils/errors.js'

export const app = express()
app.use(cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin)) }))
app.use(express.json())
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.use('/api/categories', categoryRoutes)
app.use('/api/cards', cardRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/cards', cardAdminRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/builds', buildRoutes)
app.use('/api/game', gameRoutes)
app.use('/api/friends', friendshipRoutes)
app.use('/api/search', searchRoutes)
app.use(notFound)
app.use(errorHandler)
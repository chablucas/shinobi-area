import express from 'express'
import cors from 'cors'
import { env, isAllowedOrigin } from './config/env.js'
import { cardRoutes } from './routes/cardRoutes.js'
import { categoryRoutes } from './routes/categoryRoutes.js'
import { errorHandler, notFound } from './utils/errors.js'

export const app = express()
app.use(cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin)) }))
app.use(express.json())
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.use('/api/categories', categoryRoutes)
app.use('/api/cards', cardRoutes)
app.use(notFound)
app.use(errorHandler)
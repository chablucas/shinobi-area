import { Router } from 'express'
import { postSimulation } from '../controllers/gameController.js'

export const gameRoutes = Router()
gameRoutes.post('/simulate', postSimulation)
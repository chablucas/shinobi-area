import { Router } from 'express'
import { getCardByIdOrSlug, getCards } from '../controllers/cardController.js'

export const cardRoutes = Router()
cardRoutes.get('/', getCards)
cardRoutes.get('/:idOrSlug', getCardByIdOrSlug)
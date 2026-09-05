import { Router } from 'express'
import { getAdminCardsController, getAdminOverviewController, promoteAdminController } from '../controllers/adminController.js'
import { requireAdmin } from '../middleware/admin.js'
import { requireAuth } from '../middleware/auth.js'

export const adminRoutes = Router()
adminRoutes.use(requireAuth, requireAdmin)
adminRoutes.get('/overview', getAdminOverviewController)
adminRoutes.get('/cards', getAdminCardsController)
adminRoutes.post('/promote', promoteAdminController)

import { Router } from 'express'
import { adminCard, adminRarity, adminStat, patchModifier, postModifier, removeModifier, resetRarity, resetStat } from '../controllers/cardAdminController.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
export const cardAdminRoutes = Router()
cardAdminRoutes.use(requireAuth, requireAdmin)
cardAdminRoutes.get('/:slug', adminCard)
cardAdminRoutes.put('/:slug/stats/:statKey', adminStat)
cardAdminRoutes.delete('/:slug/stats/:statKey', resetStat)
cardAdminRoutes.put('/:slug/rarity', adminRarity)
cardAdminRoutes.delete('/:slug/rarity', resetRarity)
cardAdminRoutes.post('/:slug/modifiers', postModifier)
cardAdminRoutes.patch('/modifiers/:id', patchModifier)
cardAdminRoutes.delete('/modifiers/:id', removeModifier)
import { Router } from 'express'
import { getBuildById, getBuilds, postBuild, removeBuild } from '../controllers/buildController.js'
import { requireAuth } from '../middleware/auth.js'

export const buildRoutes = Router()
buildRoutes.use(requireAuth)
buildRoutes.get('/', getBuilds)
buildRoutes.post('/', postBuild)
buildRoutes.get('/:id', getBuildById)
buildRoutes.delete('/:id', removeBuild)

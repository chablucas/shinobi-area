import { Router } from 'express'
import { acceptRequest, cancelRequest, deleteFriend, getFriends, getReceivedRequests, getSentRequests, postFriendRequest, rejectRequest, searchFriendUsers } from '../controllers/friendshipController.js'
import { requireAuth } from '../middleware/auth.js'

export const friendshipRoutes = Router()
friendshipRoutes.use(requireAuth)
friendshipRoutes.get('/', getFriends)
friendshipRoutes.get('/requests/received', getReceivedRequests)
friendshipRoutes.get('/requests/sent', getSentRequests)
friendshipRoutes.post('/requests/:requestId/accept', acceptRequest)
friendshipRoutes.post('/requests/:requestId/reject', rejectRequest)
friendshipRoutes.post('/requests/:requestId/cancel', cancelRequest)
friendshipRoutes.post('/:userId', postFriendRequest)
friendshipRoutes.delete('/:userId', deleteFriend)
friendshipRoutes.get('/search', searchFriendUsers)
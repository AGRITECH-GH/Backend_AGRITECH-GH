import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authenticate.js'
import { registerAsAgent, getAllAgents, getAgentById, assignAgentToOrder } from '../controllers/agentController.js'

const router = Router()

router.post('/register', authenticate, registerAsAgent)
router.get('/', authenticate, getAllAgents)
router.get('/:id', authenticate, getAgentById)
router.put('/orders/:orderId/assign', authenticate, authorize('ADMIN'), assignAgentToOrder)

export default router
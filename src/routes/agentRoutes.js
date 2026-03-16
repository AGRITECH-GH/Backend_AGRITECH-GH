// import { Router } from 'express'
// import { authenticate, authorize } from '../middleware/authenticate.js'
// import { registerAsAgent, getAllAgents, getAgentById, assignAgentToOrder } from '../controllers/agentController.js'

// const router = Router()

// router.post('/register', authenticate, authorize('AGENT'), registerAsAgent)
// router.get('/', authenticate, getAllAgents)
// router.get('/:id', authenticate, getAgentById)
// router.put('/orders/:orderId/assign', authenticate, authorize('ADMIN'), assignAgentToOrder)

// export default router

import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authenticate.js'
import {
    registerAsAgent, getAllAgents, getAgentById, assignAgentToOrder,
    registerFarmerAsAgent, getMyFarmers, requestAgent, handleAgentRequest, getAgentRequests
} from '../controllers/agentController.js'

const router = Router()

router.post('/register', authenticate, authorize('AGENT'), registerAsAgent)
router.post('/register-farmer', authenticate, authorize('AGENT'), registerFarmerAsAgent)
router.get('/my-farmers', authenticate, authorize('AGENT'), getMyFarmers)
router.get('/requests', authenticate, authorize('AGENT'), getAgentRequests)
router.get('/', authenticate, getAllAgents)
router.get('/:id', authenticate, getAgentById)
router.post('/:agentId/request', authenticate, authorize('FARMER'), requestAgent)
router.put('/requests/:requestId', authenticate, authorize('AGENT'), handleAgentRequest)
router.put('/orders/:orderId/assign', authenticate, authorize('ADMIN'), assignAgentToOrder)

export default router

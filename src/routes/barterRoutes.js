import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { createBarterRequest, getMyBarterRequests, updateBarterStatus } from '../controllers/barterController.js'

const router = Router()

router.post('/', authenticate, createBarterRequest)
router.get('/', authenticate, getMyBarterRequests)
router.put('/:id', authenticate, updateBarterStatus)

export default router
import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authenticate.js'
import { createOrder, getMyOrders, getOrderById, updateOrderStatus } from '../controllers/orderController.js'
import {requireVerified} from '../middleware/requireVerified.js'

const router = Router()

router.post('/', authenticate, requireVerified, authorize('BUYER'), createOrder)
router.get('/', authenticate, getMyOrders)
router.get('/:id', authenticate, getOrderById)
router.put('/:id/status', authenticate, updateOrderStatus)

export default router
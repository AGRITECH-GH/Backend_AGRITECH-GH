import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authenticate.js'
import { createOrder, getMyOrders, getOrderById, updateOrderStatus } from '../controllers/orderController.js'

const router = Router()

router.post('/', authenticate, authorize('BUYER'), createOrder)
router.get('/', authenticate, getMyOrders)
router.get('/:id', authenticate, getOrderById)
router.put('/:id/status', authenticate, updateOrderStatus)

export default router
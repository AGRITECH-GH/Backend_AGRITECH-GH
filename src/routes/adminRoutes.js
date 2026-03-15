import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authenticate.js'
import { getAllUsers, updateUser, getAllOrders, getDashboardStats, deleteUser } from '../controllers/adminController.js'

const router = Router()

router.use(authenticate, authorize('ADMIN'))

router.get('/stats', getDashboardStats)
router.get('/users', getAllUsers)
router.put('/users/:id', updateUser)
router.delete('/users/:id', deleteUser)
router.get('/orders', getAllOrders)

export default router
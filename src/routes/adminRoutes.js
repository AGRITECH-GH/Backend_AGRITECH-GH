import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authenticate.js'
import { getAllUsers, updateUser, getAllOrders, getDashboardStats, deleteUser, createCategory, getCategories, updateCategory } from '../controllers/adminController.js'

const router = Router()

router.use(authenticate, authorize('ADMIN'))

router.get('/stats', getDashboardStats)
router.get('/users', getAllUsers)
router.put('/users/:id', updateUser)
router.delete('/users/:id', deleteUser)
router.get('/orders', getAllOrders)
router.post('/categories', createCategory)
router.get('/categories', getCategories)
router.put('/categories/:id', updateCategory)

export default router
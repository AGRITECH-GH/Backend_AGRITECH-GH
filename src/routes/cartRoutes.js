import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authenticate.js'
import { getCart, addToCart, removeFromCart, clearCart, validateCart } from '../controllers/cartController.js'

const router = Router()

router.get('/', authenticate, authorize('BUYER'), getCart)
router.post('/items', authenticate, authorize('BUYER'), addToCart)
router.delete('/items/:listingId', authenticate, authorize('BUYER'), removeFromCart)
router.delete('/', authenticate, authorize('BUYER'), clearCart)
router.get('/validate', authenticate, authorize('BUYER'), validateCart)

export default router
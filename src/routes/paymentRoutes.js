import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { initializePayment, verifyPayment, paystackWebhook, getPaymentStatus } from '../controllers/paymentController.js'

const router = Router()

// Webhook must be raw body - no authentication
router.post('/webhook', paystackWebhook)

router.post('/initialize', authenticate, initializePayment)
router.get('/verify/:reference', authenticate, verifyPayment)
router.get('/order/:orderId', authenticate, getPaymentStatus)

export default router
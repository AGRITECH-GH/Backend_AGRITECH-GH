import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount,
  editProfile,
  requestEmailChange,
  confirmEmailChange
} from '../controllers/authController.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.post('/verify-email', verifyEmail)
router.post('/resend-verification', resendVerification)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.put('/change-password', authenticate, changePassword)
router.delete('/delete-account', authenticate, deleteAccount)
router.put('/edit-profile', authenticate, editProfile)
router.post('/request-email-change', authenticate, requestEmailChange)
router.post('/confirm-email-change', confirmEmailChange)

export default router
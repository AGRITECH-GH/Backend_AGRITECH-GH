import { Router } from "express";
import { changePassword, register } from "../controllers/authController.js";
import { login } from "../controllers/authController.js";
import { refresh } from "../controllers/authController.js";
import { logout } from "../controllers/authController.js";
import { verifyEmail } from "../controllers/authController.js";
import { resendVerification } from "../controllers/authController.js";
import { forgotPassword } from "../controllers/authController.js";
import { resetPassword } from "../controllers/authController.js";
import { changePassword } from "../controllers/authController.js";
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

export default router
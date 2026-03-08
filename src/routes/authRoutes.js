import { Router } from "express";
import { register } from "../controllers/authController.js";
import { login } from "../controllers/authController.js";
import { refresh } from "../controllers/authController.js";
import { logout } from "../controllers/authController.js";
import { verifyEmail } from "../controllers/authController.js";
import { resendVerification } from "../controllers/authController.js";

const router = Router()

router.post('/register',register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.post('/verify-email', verifyEmail)
router.post('/resend-verification', resendVerification)

export default router
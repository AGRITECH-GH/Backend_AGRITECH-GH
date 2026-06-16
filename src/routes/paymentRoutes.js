/**
 * @file paymentRoutes.js
 * @description Paystack payment routes.
 *
 * Security:
 *  - /webhook: raw body preserved for HMAC-SHA512 signature verification;
 *    no authentication (Paystack server-to-server). Signature verified in controller.
 *  - paymentLimiter (10/hr per IP) on /initialize — prevents gateway abuse (A04)
 *  - publicReadLimiter (60/min per IP) on read endpoints — prevents polling abuse
 *  - authenticate: all non-webhook routes require a valid JWT (A01)
 */
import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  initializePayment,
  verifyPayment,
  paystackWebhook,
  getPaymentStatus,
} from "../controllers/paymentController.js";
import { paymentLimiter, publicReadLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Webhook — raw body required for HMAC verification; no auth
router.post("/webhook", paystackWebhook);

router.post("/initialize", authenticate, paymentLimiter, initializePayment);
router.get("/verify/:reference", authenticate, publicReadLimiter, verifyPayment);
router.get("/order/:orderId",    authenticate, publicReadLimiter, getPaymentStatus);

export default router;

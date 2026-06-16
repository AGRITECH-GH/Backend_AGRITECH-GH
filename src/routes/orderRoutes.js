/**
 * @file orderRoutes.js
 * @description Order management routes.
 *
 * Security:
 *  - validate(schemas.createOrder): enforces paymentMethod enum, address/notes
 *    length limits, and mass-assignment protection (A03)
 *  - authenticatedWriteLimiter (60/15 min per userId+IP) on mutations (A04)
 */
import { Router } from "express";
import { authenticate, authorize } from "../middleware/authenticate.js";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { requireVerified } from "../middleware/requireVerified.js";
import { validate, schemas } from "../middleware/validate.js";
import { authenticatedWriteLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post(
  "/",
  authenticate,
  requireVerified,
  authorize("BUYER"),
  authenticatedWriteLimiter,
  validate(schemas.createOrder),
  createOrder,
);
router.get("/:id", authenticate, getOrderById);
router.get("/", authenticate, getMyOrders);
router.put("/:id/status", authenticate, authenticatedWriteLimiter, updateOrderStatus);

export default router;
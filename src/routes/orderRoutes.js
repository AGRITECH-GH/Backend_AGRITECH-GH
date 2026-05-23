/**
 * @file orderRoutes.js
 * @description Order management routes.
 *
 * Security: validate() middleware on POST / ensures paymentMethod, deliveryAddress,
 * and notes are validated and length-limited before the controller runs.
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

const router = Router();

router.post(
  "/",
  authenticate,
  requireVerified,
  authorize("BUYER"),
  validate(schemas.createOrder),
  createOrder
);
router.get("/:id", authenticate, getOrderById);
router.get("/", authenticate, getMyOrders);
router.put("/:id/status", authenticate, updateOrderStatus);

export default router;
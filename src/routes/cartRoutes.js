/**
 * @file cartRoutes.js
 * @description Shopping cart routes (BUYER only).
 *
 * Security:
 *  - authenticate + authorize("BUYER"): all routes require a verified BUYER JWT (A01)
 *  - authenticatedWriteLimiter: 60 write ops / 15 min per userId+IP on mutations
 *    (A04 — prevents cart-flooding and inventory enumeration via add/remove loops)
 *  - validate(schemas.addToCart): enforces listingId (string, max 100) and
 *    quantity (positive number, min 0.001) with mass-assignment protection (A03)
 */
import { Router } from "express";
import { authenticate, authorize } from "../middleware/authenticate.js";
import {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  validateCart,
} from "../controllers/cartController.js";
import { authenticatedWriteLimiter } from "../middleware/rateLimiter.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

router.get("/", authenticate, authorize("BUYER"), getCart);

router.post(
  "/items",
  authenticate,
  authorize("BUYER"),
  authenticatedWriteLimiter,
  validate(schemas.addToCart),
  addToCart,
);

router.delete(
  "/items/:listingId",
  authenticate,
  authorize("BUYER"),
  authenticatedWriteLimiter,
  removeFromCart,
);

router.delete(
  "/",
  authenticate,
  authorize("BUYER"),
  authenticatedWriteLimiter,
  clearCart,
);

router.get("/validate", authenticate, authorize("BUYER"), validateCart);

export default router;

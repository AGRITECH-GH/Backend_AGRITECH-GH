/**
 * @file disputeRoutes.js
 * @description Dispute management routes (buyer-facing).
 *
 * Security:
 *  - authenticate: all routes require a valid JWT (A01)
 *  - authenticatedWriteLimiter: 60 write ops / 15 min per userId+IP on POST /
 *    (A04 — prevents dispute-spam; 7-day window is also enforced in controller)
 *  - validate(schemas.createDispute): enforces orderId, reason length (max 500),
 *    details length (max 2000), and mass-assignment protection (A03)
 */
import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createDispute,
  getDisputes,
  getDisputeById,
} from "../controllers/disputeController.js";
import { authenticatedWriteLimiter } from "../middleware/rateLimiter.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

router.use(authenticate);

router.post("/", authenticatedWriteLimiter, validate(schemas.createDispute), createDispute);
router.get("/", getDisputes);
router.get("/:id", getDisputeById);

export default router;

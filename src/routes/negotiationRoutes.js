/**
 * @file negotiationRoutes.js
 * @description Price negotiation offer routes.
 *
 * Security:
 *  - authenticate: all routes require a valid JWT (A01)
 *  - authenticatedWriteLimiter: 60 write ops / 15 min per userId+IP on mutations
 *    (A04 — prevents offer-spam and counter-offer loops)
 *  - validate(schemas.*): schema-based input validation & mass-assignment
 *    protection; enforces enum on status and length cap on note (A03)
 */
import express from "express";
import {
  makeOffer,
  getOffers,
  respondToOffer,
} from "../controllers/negotiationController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authenticatedWriteLimiter } from "../middleware/rateLimiter.js";
import { validate, schemas } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticate);

router.post("/", authenticatedWriteLimiter, validate(schemas.makeOffer), makeOffer);
router.get("/", getOffers);
router.patch("/:offerId", authenticatedWriteLimiter, validate(schemas.respondToOffer), respondToOffer);

export default router;

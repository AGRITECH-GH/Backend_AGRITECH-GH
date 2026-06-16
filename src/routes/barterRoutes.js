/**
 * @file barterRoutes.js
 * @description Barter request routes.
 *
 * Security:
 *  - authenticate: all routes require a valid JWT (A01)
 *  - authenticatedWriteLimiter: 60 write ops / 15 min per userId+IP on mutations
 *    (A04 — prevents spam barter requests)
 *  - validate(schemas.*): schema-based input validation & mass-assignment
 *    protection on POST / and PUT /:id (A03)
 */
import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createBarterRequest,
  getMyBarterRequests,
  updateBarterStatus,
} from "../controllers/barterController.js";
import { authenticatedWriteLimiter } from "../middleware/rateLimiter.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  authenticatedWriteLimiter,
  validate(schemas.createBarterRequest),
  createBarterRequest,
);

router.get("/", getMyBarterRequests);

router.put(
  "/:id",
  authenticatedWriteLimiter,
  validate(schemas.updateBarterStatus),
  updateBarterStatus,
);

export default router;

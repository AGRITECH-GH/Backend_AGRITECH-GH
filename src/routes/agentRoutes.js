/**
 * @file agentRoutes.js
 * @description Agent management routes.
 *
 * Security:
 *  - authenticate + authorize: all routes require appropriate role JWT (A01)
 *  - authenticatedWriteLimiter (60/15 min per userId+IP) on all mutations (A04)
 *  - KYC file uploads validated by multer middleware (MIME type, size) (A03)
 */
import { Router } from "express";
import { authenticate, authorize } from "../middleware/authenticate.js";
import {
  registerAsAgent,
  getAllAgents,
  getAgentById,
  assignAgentToOrder,
  registerFarmerAsAgent,
  getMyFarmers,
  requestAgent,
  handleAgentRequest,
  getAgentRequests,
} from "../controllers/agentController.js";
import { uploadKYCDocuments } from "../middleware/upload.js";
import { authenticatedWriteLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/register",         authenticate, authorize("AGENT"),  authenticatedWriteLimiter, registerAsAgent);
router.post(
  "/register-farmer",
  authenticate,
  authorize("AGENT"),
  authenticatedWriteLimiter,
  uploadKYCDocuments,
  registerFarmerAsAgent,
);
router.get("/my-farmers",        authenticate, authorize("AGENT"),  getMyFarmers);
router.get("/requests",          authenticate, authorize("AGENT"),  getAgentRequests);
router.get("/",                  authenticate,                       getAllAgents);
router.get("/:id",               authenticate,                       getAgentById);
router.post(
  "/:agentId/request",
  authenticate,
  authorize("FARMER"),
  authenticatedWriteLimiter,
  requestAgent,
);
router.put(
  "/requests/:requestId",
  authenticate,
  authorize("AGENT"),
  authenticatedWriteLimiter,
  handleAgentRequest,
);
router.put(
  "/orders/:orderId/assign",
  authenticate,
  authorize("ADMIN"),
  authenticatedWriteLimiter,
  assignAgentToOrder,
);

export default router;

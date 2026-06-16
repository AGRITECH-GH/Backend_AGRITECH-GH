/**
 * @file adminRoutes.js
 * @description Admin-only management routes.
 *
 * Security:
 *  - authenticate + authorize("ADMIN"): applied to the entire router (A01/A07)
 *  - authenticatedWriteLimiter (60/15 min per userId+IP) on all mutating routes
 *    (A04 — admins are privileged users; limiting writes prevents runaway scripts
 *    or compromised admin sessions from bulk-deleting data)
 */
import { Router } from "express";
import { authenticate, authorize } from "../middleware/authenticate.js";
import {
  getAllUsers,
  updateUser,
  getAllOrders,
  getDashboardStats,
  deleteUser,
  createCategory,
  getCategories,
  updateCategory,
  getPendingKYCSubmissions,
  getReviewedKYCSubmissions,
  approveKYC,
  rejectKYC,
  getKYCStatus,
  resendKYCDecisionEmail,
} from "../controllers/adminController.js";
import {
  getDisputes,
  getDisputeById,
  mediateDispute,
} from "../controllers/disputeController.js";
import { authenticatedWriteLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.use(authenticate, authorize("ADMIN"));

// Read-only — covered by globalLimiter applied at app level
router.get("/stats",          getDashboardStats);
router.get("/users",          getAllUsers);
router.get("/orders",         getAllOrders);
router.get("/categories",     getCategories);

// Write — additionally rate-limited per userId+IP
router.put("/users/:id",      authenticatedWriteLimiter, updateUser);
router.delete("/users/:id",   authenticatedWriteLimiter, deleteUser);
router.post("/categories",    authenticatedWriteLimiter, createCategory);
router.put("/categories/:id", authenticatedWriteLimiter, updateCategory);

// KYC Management
router.get("/kyc/pending",                    getPendingKYCSubmissions);
router.get("/kyc/reviewed",                   getReviewedKYCSubmissions);
router.get("/kyc/:userId",                    getKYCStatus);
router.put("/kyc/:userId/approve",            authenticatedWriteLimiter, approveKYC);
router.put("/kyc/:userId/reject",             authenticatedWriteLimiter, rejectKYC);
router.post("/kyc/:userId/resend-email",      authenticatedWriteLimiter, resendKYCDecisionEmail);

// Dispute mediation
router.get("/disputes",       getDisputes);
router.get("/disputes/:id",   getDisputeById);
router.patch("/disputes/:id", authenticatedWriteLimiter, mediateDispute);

export default router;

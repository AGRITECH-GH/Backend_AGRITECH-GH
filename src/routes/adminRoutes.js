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

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/stats", getDashboardStats);
router.get("/users", getAllUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.get("/orders", getAllOrders);
router.post("/categories", createCategory);
router.get("/categories", getCategories);
router.put("/categories/:id", updateCategory);

// KYC Management Routes
router.get("/kyc/pending", getPendingKYCSubmissions);
router.get("/kyc/reviewed", getReviewedKYCSubmissions);
router.get("/kyc/:userId", getKYCStatus);
router.put("/kyc/:userId/approve", approveKYC);
router.put("/kyc/:userId/reject", rejectKYC);
router.post("/kyc/:userId/resend-email", resendKYCDecisionEmail);

export default router;

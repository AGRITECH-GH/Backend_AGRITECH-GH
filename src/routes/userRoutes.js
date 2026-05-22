import { Router } from "express";
import {
  getPublicUserProfile,
  getPublicUserReviews,
  getPublicUserStats,
} from "../controllers/userController.js";

const router = Router();

router.get("/:id/profile", getPublicUserProfile);
router.get("/:id/stats", getPublicUserStats);
router.get("/:id/reviews", getPublicUserReviews);

export default router;

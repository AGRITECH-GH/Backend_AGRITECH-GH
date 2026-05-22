import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createReview,
  getReviews,
  getReviewForOrder,
} from "../controllers/reviewController.js";

const router = Router();

router.use(authenticate);
router.post("/", createReview);
router.get("/", getReviews);
router.get("/order/:orderId", getReviewForOrder);

export default router;

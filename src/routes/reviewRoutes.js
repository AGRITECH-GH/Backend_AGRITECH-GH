/**
 * @file reviewRoutes.js
 * @description Review routes with inline schema validation.
 */
import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createReview,
  getReviews,
  getReviewForOrder,
} from "../controllers/reviewController.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

router.use(authenticate);

// validate() ensures orderId, rating, type, and comment are all within bounds
router.post("/", validate(schemas.createReview, { allowExtra: false }), createReview);
router.get("/", getReviews);
router.get("/order/:orderId", getReviewForOrder);

export default router;

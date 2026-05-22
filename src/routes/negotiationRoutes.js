import express from "express";
import {
  makeOffer,
  getOffers,
  respondToOffer,
} from "../controllers/negotiationController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = express.Router();

router.use(authenticate);

router.post("/", makeOffer);
router.get("/", getOffers);
router.patch("/:offerId", respondToOffer);

export default router;

import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createDispute,
  getDisputes,
  getDisputeById,
} from "../controllers/disputeController.js";

const router = Router();

router.use(authenticate);
router.post("/", createDispute);
router.get("/", getDisputes);
router.get("/:id", getDisputeById);

export default router;

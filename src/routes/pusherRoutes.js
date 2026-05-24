import express from "express";
import { handlePusherWebhook } from "../controllers/pusherController.js";

const router = express.Router();

// Webhook must use express.raw to properly validate the signature
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handlePusherWebhook
);

export default router;

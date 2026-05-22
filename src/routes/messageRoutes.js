import express from "express";
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  getUnreadCount,
} from "../controllers/messageController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getConversations);
router.post("/", getOrCreateConversation);
router.get("/unread-count", getUnreadCount);
router.get("/:conversationId/messages", getMessages);
router.post("/:conversationId/messages", sendMessage);

export default router;

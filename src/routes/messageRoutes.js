/**
 * @file messageRoutes.js
 * @description Conversation & message routes with inline schema validation.
 */
import express from "express";
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  getUnreadCount,
} from "../controllers/messageController.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate, schemas } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getConversations);
// validate() ensures otherUserId and optional listingId are present and sane
router.post("/", validate(schemas.createConversation), getOrCreateConversation);
router.get("/unread-count", getUnreadCount);
router.get("/:conversationId/messages", getMessages);
// validate() ensures content is present and within 2000 chars
router.post("/:conversationId/messages", validate(schemas.sendMessage), sendMessage);

export default router;

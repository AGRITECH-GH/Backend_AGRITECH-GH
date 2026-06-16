/**
 * @file messageRoutes.js
 * @description Conversation & message routes with inline schema validation.
 *
 * Security:
 *  - authenticate: all routes require a valid JWT (A01)
 *  - authenticatedWriteLimiter (60/15 min per userId+IP) on write routes (A04)
 *  - validate(schemas.*): enforces field presence, types, and length caps (A03)
 *    · createConversation: otherUserId required (max 100), listingId optional
 *    · sendMessage: content required (1–2000 chars)
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
import { authenticatedWriteLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getConversations);
router.post("/", authenticatedWriteLimiter, validate(schemas.createConversation), getOrCreateConversation);
router.get("/unread-count", getUnreadCount);
router.get("/:conversationId/messages", getMessages);
router.post("/:conversationId/messages", authenticatedWriteLimiter, validate(schemas.sendMessage), sendMessage);

export default router;

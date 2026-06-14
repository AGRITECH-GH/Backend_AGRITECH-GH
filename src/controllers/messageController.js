import prisma from "../config/prisma.js";
import { pushEvent } from "../config/pusher.js";
import { createMessageNotification } from "./notificationController.js";
import { sendNewMessageEmail } from "../services/emailService.js";

/**
 * GET /api/conversations
 * Returns all conversations for the current user, sorted by last message.
 */
export const getConversations = async (req, res) => {
  const userId = req.user.id;
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ participantAId: userId }, { participantBId: userId }],
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        participantA: {
          select: { id: true, fullName: true, profilePhotoUrl: true },
        },
        participantB: {
          select: { id: true, fullName: true, profilePhotoUrl: true },
        },
        listing: {
          select: { id: true, title: true, pricePerUnit: true, unit: true },
        },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            sentAt: true,
            type: true,
            senderId: true,
          },
        },
        _count: {
          select: {
            messages: { where: { receiverId: userId, isRead: false } },
          },
        },
      },
    });

    // Normalise: always expose the "other" participant as `otherUser`
    const result = conversations.map((c) => {
      const otherUser =
        c.participantAId === userId ? c.participantB : c.participantA;
      const lastMessage = c.messages[0] ?? null;
      return {
        id: c.id,
        otherUser,
        listing: c.listing,
        lastMessage,
        unreadCount: c._count.messages,
        updatedAt: c.lastMessageAt ?? c.createdAt,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
};

/**
 * POST /api/conversations
 * Start or retrieve a conversation between the current user and another user,
 * optionally tied to a listing.
 * Body: { otherUserId, listingId? }
 */
export const getOrCreateConversation = async (req, res) => {
  const userId = req.user.id;
  const { otherUserId, listingId } = req.body;

  if (!otherUserId)
    return res.status(400).json({ message: "otherUserId is required" });
  if (userId === otherUserId)
    return res
      .status(400)
      .json({ message: "Cannot start a conversation with yourself" });

  // Enforce consistent ordering so we don't create duplicate rows
  const [participantAId, participantBId] = [userId, otherUserId].sort();

  try {
    const conversation = await prisma.conversation.upsert({
      where: {
        participantAId_participantBId_listingId: {
          participantAId,
          participantBId,
          listingId: listingId ?? null,
        },
      },
      update: {},
      create: {
        participantAId,
        participantBId,
        listingId: listingId ?? null,
      },
      include: {
        participantA: {
          select: { id: true, fullName: true, profilePhotoUrl: true },
        },
        participantB: {
          select: { id: true, fullName: true, profilePhotoUrl: true },
        },
        listing: {
          select: { id: true, title: true, pricePerUnit: true, unit: true },
        },
      },
    });

    const otherUser =
      conversation.participantAId === userId
        ? conversation.participantB
        : conversation.participantA;

    res.json({ ...conversation, otherUser });
  } catch (err) {
    console.error("getOrCreateConversation error:", err);
    res.status(500).json({ message: "Failed to create conversation" });
  }
};

/**
 * GET /api/conversations/:conversationId/messages
 * Paginated message history for a conversation.
 * Query: page (default 1), limit (default 30)
 */
export const getMessages = async (req, res) => {
  const userId = req.user.id;
  const { conversationId } = req.params;
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit ?? "30", 10)),
  );

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });
    if (
      conversation.participantAId !== userId &&
      conversation.participantBId !== userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const [messages, total] = await prisma.$transaction([
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { sentAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sender: {
            select: { id: true, fullName: true, profilePhotoUrl: true },
          },
          attachments: true,
        },
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    // Mark unread messages sent to current user as read
    await prisma.message.updateMany({
      where: { conversationId, receiverId: userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ messages, total, page, limit });
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

/**
 * POST /api/conversations/:conversationId/messages
 * Send a text message (and optionally trigger Pusher + notification).
 * Body: { content }
 */
export const sendMessage = async (req, res) => {
  const userId = req.user.id;
  const { conversationId } = req.params;
  const { content } = req.body;

  // OWASP A04 \u2013 enforce a reasonable max length to prevent oversized payloads
  if (!content?.trim())
    return res.status(400).json({ message: "Message content is required" });
  if (String(content).trim().length > 2000)
    return res.status(400).json({ message: "Message content must be at most 2000 characters" });

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participantA: { select: { id: true, email: true, fullName: true, isOnline: true, lastMessageEmailSentAt: true } },
        participantB: { select: { id: true, email: true, fullName: true, isOnline: true, lastMessageEmailSentAt: true } },
        listing: { select: { id: true, title: true } },
      },
    });
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });
    if (
      conversation.participantAId !== userId &&
      conversation.participantBId !== userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const receiverId =
      conversation.participantAId === userId
        ? conversation.participantBId
        : conversation.participantAId;

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          content: content.trim(),
          senderId: userId,
          receiverId,
          conversationId,
          listingId: conversation.listingId,
        },
        include: {
          sender: {
            select: { id: true, fullName: true, profilePhotoUrl: true },
          },
          attachments: true,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    // Pusher realtime push to the receiver's private channel
    await pushEvent(`private-user-${receiverId}`, "new-message", {
      conversationId,
      message,
    });

    // In-app notification (fire-and-forget)
    const sender =
      conversation.participantAId === userId
        ? conversation.participantA
        : conversation.participantB;
    const receiver =
      conversation.participantAId === userId
        ? conversation.participantB
        : conversation.participantA;
        
    createMessageNotification({
      receiverId,
      senderName: sender.fullName,
      conversationId,
      listing: conversation.listing,
    }).catch(() => {});

    // Email notification (fire-and-forget)
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const timeSinceLastEmail = receiver.lastMessageEmailSentAt 
      ? new Date() - new Date(receiver.lastMessageEmailSentAt) 
      : Infinity;

    if (!receiver.isOnline && timeSinceLastEmail > FIVE_MINUTES_MS) {
      sendNewMessageEmail({
        email: receiver.email,
        recipientName: receiver.fullName,
        senderName: sender.fullName,
        listingTitle: conversation.listing?.title,
        conversationId,
      }).catch((err) => console.error("Failed to send new message email:", err));
      
      // Update lastMessageEmailSentAt
      prisma.user.update({
        where: { id: receiverId },
        data: { lastMessageEmailSentAt: new Date() },
      }).catch(() => {});
    }

    res.status(201).json(message);
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
};

/**
 * GET /api/conversations/unread-count
 * Returns total unread message count for the current user.
 */
export const getUnreadCount = async (req, res) => {
  const userId = req.user.id;
  try {
    const count = await prisma.message.count({
      where: { receiverId: userId, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    console.error("getUnreadCount error:", err);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};

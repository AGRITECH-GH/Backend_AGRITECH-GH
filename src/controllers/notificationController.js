import prisma from "../config/prisma.js";
import { pushEvent } from "../config/pusher.js";

/**
 * Create or update an in-app notification.
 * Exported so other controllers can call it directly.
 */
export const createNotification = async ({
  userId,
  type,
  title,
  message,
  referenceId,
}) => {
  return prisma.notification.create({
    data: { userId, type, title, message, referenceId: referenceId ?? null },
  });
};

/** Convenience wrapper for new-message notifications */
export const createMessageNotification = async ({
  receiverId,
  senderName,
  conversationId,
  listing,
}) => {
  const title = listing
    ? `New message about "${listing.title}"`
    : `New message from ${senderName}`;
  return createNotification({
    userId: receiverId,
    type: "MESSAGE",
    title,
    message: `${senderName} sent you a message.`,
    referenceId: conversationId,
  });
};

/** Convenience wrapper for negotiation notifications */
export const createNegotiationNotification = async ({
  receiverId,
  senderName,
  offerStatus,
  offerId,
  listingTitle,
}) => {
  const verbs = {
    PENDING: "made a new offer on",
    ACCEPTED: "accepted your offer on",
    REJECTED: "declined your offer on",
    COUNTERED: "countered your offer on",
    WITHDRAWN: "withdrew their offer on",
  };
  const verb = verbs[offerStatus] ?? "updated an offer on";
  return createNotification({
    userId: receiverId,
    type: "NEGOTIATION",
    title: `Offer ${offerStatus.toLowerCase()} — ${listingTitle}`,
    message: `${senderName} ${verb} "${listingTitle}".`,
    referenceId: offerId,
  });
};

/**
 * GET /api/notifications
 * Returns paginated notifications for the current user.
 * Query: page, limit, unreadOnly
 */
export const getNotifications = async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(req.query.limit ?? "20", 10)),
  );
  const unreadOnly = req.query.unreadOnly === "true";

  try {
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    const [notifications, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    res.json({ notifications, total, page, limit, unreadCount });
  } catch (err) {
    console.error("getNotifications error:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
export const markRead = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notification)
      return res.status(404).json({ message: "Notification not found" });
    if (notification.userId !== userId)
      return res.status(403).json({ message: "Access denied" });

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    res.json(updated);
  } catch (err) {
    console.error("markRead error:", err);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
};

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all unread notifications for the current user as read.
 */
export const markAllRead = async (req, res) => {
  const userId = req.user.id;
  try {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("markAllRead error:", err);
    res.status(500).json({ message: "Failed to mark notifications as read" });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a single notification (owner only).
 */
export const deleteNotification = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notification)
      return res.status(404).json({ message: "Notification not found" });
    if (notification.userId !== userId)
      return res.status(403).json({ message: "Access denied" });

    await prisma.notification.delete({ where: { id } });
    res.json({ message: "Notification deleted" });
  } catch (err) {
    console.error("deleteNotification error:", err);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};

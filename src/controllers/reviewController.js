import prisma from "../config/prisma.js";
import { createNotification } from "./notificationController.js";

const REVIEW_TYPES = new Set(["BUYER", "SELLER", "AGENT"]);

const parsePaging = (query) => {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? "20", 10)));
  return { page, limit, skip: (page - 1) * limit };
};

export const createReview = async (req, res) => {
  const reviewerId = req.user.id;
  const { orderId, rating, comment, type } = req.body;
  const normalizedType = String(type || "SELLER").toUpperCase();

  const numericRating = Number(rating);
  if (!orderId) {
    return res.status(400).json({ message: "orderId is required" });
  }
  if (
    !Number.isInteger(numericRating) ||
    numericRating < 1 ||
    numericRating > 5
  ) {
    return res
      .status(400)
      .json({ message: "rating must be an integer between 1 and 5" });
  }
  if (!REVIEW_TYPES.has(normalizedType)) {
    return res.status(400).json({ message: "Invalid review type" });
  }

  // OWASP A04 \u2013 cap comment length to protect DB and prevent spam
  if (comment !== undefined && comment !== null && String(comment).trim().length > 1000) {
    return res.status(400).json({ message: "comment must be at most 1000 characters" });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                sellerId: true,
                seller: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.buyerId !== reviewerId) {
      return res
        .status(403)
        .json({ message: "Only the buyer can leave a review for this order" });
    }

    if (order.status !== "DELIVERED") {
      return res
        .status(400)
        .json({ message: "Reviews are only allowed after delivery" });
    }

    if (!order.items.length || !order.items[0].listing?.sellerId) {
      return res
        .status(400)
        .json({ message: "Order has no reviewable seller" });
    }

    const reviewedUser = order.items[0].listing.seller;

    const existing = await prisma.review.findUnique({ where: { orderId } });
    if (existing) {
      return res
        .status(409)
        .json({ message: "A review already exists for this order" });
    }

    const review = await prisma.review.create({
      data: {
        orderId,
        reviewerId,
        reviewedUserId: reviewedUser.id,
        rating: numericRating,
        comment: comment ? String(comment).trim() : null,
        type: normalizedType,
      },
      include: {
        reviewer: { select: { id: true, fullName: true } },
        reviewedUser: { select: { id: true, fullName: true } },
      },
    });

    createNotification({
      userId: reviewedUser.id,
      type: "REVIEW",
      title: "New review received",
      message: `${review.reviewer.fullName} left you a ${numericRating}-star review.`,
      referenceId: review.id,
    }).catch(() => {});

    return res.status(201).json({ message: "Review submitted", review });
  } catch (error) {
    console.error("createReview error:", error);
    return res.status(500).json({ message: "Failed to create review" });
  }
};

export const getReviews = async (req, res) => {
  const userId = req.user.id;
  const direction = String(req.query.direction || "received").toLowerCase();
  const { page, limit, skip } = parsePaging(req.query);

  const where =
    direction === "given"
      ? { reviewerId: userId }
      : direction === "all"
        ? { OR: [{ reviewerId: userId }, { reviewedUserId: userId }] }
        : { reviewedUserId: userId };

  try {
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          reviewer: {
            select: { id: true, fullName: true, profilePhotoUrl: true },
          },
          reviewedUser: {
            select: { id: true, fullName: true, profilePhotoUrl: true },
          },
          order: { select: { id: true, status: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return res.json({ reviews, total, page, limit });
  } catch (error) {
    console.error("getReviews error:", error);
    return res.status(500).json({ message: "Failed to fetch reviews" });
  }
};

export const getReviewForOrder = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  try {
    const review = await prisma.review.findUnique({
      where: { orderId },
      include: {
        reviewer: {
          select: { id: true, fullName: true, profilePhotoUrl: true },
        },
        reviewedUser: {
          select: { id: true, fullName: true, profilePhotoUrl: true },
        },
      },
    });

    if (!review) {
      return res
        .status(404)
        .json({ message: "Review not found for this order" });
    }

    if (
      review.reviewerId !== userId &&
      review.reviewedUserId !== userId &&
      req.user.role !== "ADMIN"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.json(review);
  } catch (error) {
    console.error("getReviewForOrder error:", error);
    return res.status(500).json({ message: "Failed to fetch review" });
  }
};

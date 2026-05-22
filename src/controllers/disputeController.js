import prisma from "../config/prisma.js";
import { createNotification } from "./notificationController.js";

const DISPUTE_WINDOW_DAYS = 7;

const parsePaging = (query) => {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? "20", 10)));
  return { page, limit, skip: (page - 1) * limit };
};

const getDeliveredDate = (order) =>
  order.deliveredAt ?? order.updatedAt ?? order.createdAt;

const canAccessDispute = (dispute, user) => {
  if (user.role === "ADMIN") return true;
  if (dispute.filedById === user.id) return true;

  return dispute.order.items.some((item) => item.listing.sellerId === user.id);
};

export const createDispute = async (req, res) => {
  const filedById = req.user.id;
  const { orderId, reason, details, evidenceUrls } = req.body;

  if (!orderId || !String(reason || "").trim()) {
    return res.status(400).json({ message: "orderId and reason are required" });
  }

  const cleanEvidence = Array.isArray(evidenceUrls)
    ? evidenceUrls.filter((url) => typeof url === "string" && url.trim())
    : [];

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            listing: { select: { id: true, title: true, sellerId: true } },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.buyerId !== filedById) {
      return res
        .status(403)
        .json({ message: "Only the buyer can open a dispute for this order" });
    }

    if (order.status !== "DELIVERED") {
      return res
        .status(400)
        .json({ message: "Disputes are only allowed for delivered orders" });
    }

    const deliveredDate = getDeliveredDate(order);
    const ageMs = Date.now() - new Date(deliveredDate).getTime();
    if (ageMs > DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      return res
        .status(400)
        .json({
          message: "Dispute window has expired (7 days after delivery)",
        });
    }

    const existing = await prisma.dispute.findUnique({ where: { orderId } });
    if (existing) {
      return res
        .status(409)
        .json({ message: "A dispute already exists for this order" });
    }

    const dispute = await prisma.dispute.create({
      data: {
        orderId,
        filedById,
        reason: String(reason).trim(),
        details: details ? String(details).trim() : null,
        evidenceUrls: cleanEvidence.length ? cleanEvidence : null,
      },
      include: {
        filedBy: { select: { id: true, fullName: true } },
        order: {
          select: {
            id: true,
            status: true,
            deliveredAt: true,
            items: {
              select: {
                listing: { select: { id: true, title: true, sellerId: true } },
              },
            },
          },
        },
      },
    });

    const sellerId = dispute.order.items[0]?.listing?.sellerId;
    if (sellerId) {
      createNotification({
        userId: sellerId,
        type: "DISPUTE",
        title: "Order dispute opened",
        message: `A buyer opened a dispute for order #${dispute.order.id.slice(-8).toUpperCase()}.`,
        referenceId: dispute.id,
      }).catch(() => {});
    }

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: "DISPUTE",
          title: "New dispute in queue",
          message: `Dispute #${dispute.id.slice(-8).toUpperCase()} needs mediation review.`,
          referenceId: dispute.id,
        }),
      ),
    ).catch(() => {});

    return res.status(201).json({ message: "Dispute opened", dispute });
  } catch (error) {
    console.error("createDispute error:", error);
    return res.status(500).json({ message: "Failed to create dispute" });
  }
};

export const getDisputes = async (req, res) => {
  const { status } = req.query;
  const { page, limit, skip } = parsePaging(req.query);
  const user = req.user;

  const where = {};
  if (status) where.status = String(status).toUpperCase();

  if (user.role !== "ADMIN") {
    where.OR = [
      { filedById: user.id },
      { order: { items: { some: { listing: { sellerId: user.id } } } } },
    ];
  }

  try {
    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          filedBy: { select: { id: true, fullName: true, email: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
          order: {
            select: {
              id: true,
              status: true,
              totalPrice: true,
              deliveredAt: true,
              buyer: { select: { id: true, fullName: true, email: true } },
              items: {
                select: {
                  listing: {
                    select: {
                      id: true,
                      title: true,
                      sellerId: true,
                      seller: {
                        select: { id: true, fullName: true, email: true },
                      },
                    },
                  },
                },
              },
            },
          },
          auditLogs: {
            include: {
              admin: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dispute.count({ where }),
    ]);

    return res.json({ disputes, total, page, limit });
  } catch (error) {
    console.error("getDisputes error:", error);
    return res.status(500).json({ message: "Failed to fetch disputes" });
  }
};

export const getDisputeById = async (req, res) => {
  const { id } = req.params;

  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        filedBy: { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
        order: {
          include: {
            buyer: { select: { id: true, fullName: true, email: true } },
            items: {
              include: {
                listing: {
                  select: {
                    id: true,
                    title: true,
                    sellerId: true,
                    seller: {
                      select: { id: true, fullName: true, email: true },
                    },
                  },
                },
              },
            },
          },
        },
        auditLogs: {
          include: { admin: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    if (!canAccessDispute(dispute, req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.json(dispute);
  } catch (error) {
    console.error("getDisputeById error:", error);
    return res.status(500).json({ message: "Failed to fetch dispute" });
  }
};

export const mediateDispute = async (req, res) => {
  const { id } = req.params;
  const { status, resolutionNote, mediationNote } = req.body;
  const normalizedStatus = String(status || "").toUpperCase();
  const allowed = new Set(["UNDER_REVIEW", "RESOLVED", "REJECTED"]);

  if (!allowed.has(normalizedStatus)) {
    return res.status(400).json({ message: "Invalid mediation status" });
  }

  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        filedBy: { select: { id: true, fullName: true } },
        order: {
          select: {
            id: true,
            items: { select: { listing: { select: { sellerId: true } } } },
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    const isFinal =
      normalizedStatus === "RESOLVED" || normalizedStatus === "REJECTED";

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.dispute.update({
        where: { id },
        data: {
          status: normalizedStatus,
          assignedToId: req.user.id,
          mediationNote: mediationNote
            ? String(mediationNote).trim()
            : dispute.mediationNote,
          resolutionNote: isFinal
            ? String(resolutionNote || mediationNote || "").trim() || null
            : dispute.resolutionNote,
          resolvedAt: isFinal ? new Date() : null,
        },
      });

      await tx.disputeAuditLog.create({
        data: {
          disputeId: id,
          adminId: req.user.id,
          action: `STATUS_${normalizedStatus}`,
          note: String(resolutionNote || mediationNote || "").trim() || null,
        },
      });

      return row;
    });

    const sellerId = dispute.order.items[0]?.listing?.sellerId;
    const recipients = [dispute.filedBy.id, sellerId].filter(Boolean);

    Promise.all(
      recipients.map((userId) =>
        createNotification({
          userId,
          type: "DISPUTE",
          title: `Dispute ${normalizedStatus.toLowerCase().replace("_", " ")}`,
          message: `Dispute #${dispute.id.slice(-8).toUpperCase()} status changed to ${normalizedStatus}.`,
          referenceId: dispute.id,
        }),
      ),
    ).catch(() => {});

    return res.json({ message: "Dispute updated", dispute: updated });
  } catch (error) {
    console.error("mediateDispute error:", error);
    return res.status(500).json({ message: "Failed to mediate dispute" });
  }
};

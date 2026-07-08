import prisma from "../config/prisma.js";
import { sendKYCStatusEmail } from "../services/emailService.js";
import { withSignedKycUrls } from "../utils/kycUrl.js";

const KYC_EMAIL_ACTIONS = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  RESEND: "RESEND",
};

const updateKYCEmailAudit = async ({ userId, status, action, error = null }) =>
  prisma.user.update({
    where: { id: userId },
    data: {
      kycEmailLastSentAt: new Date(),
      kycEmailLastStatus: status,
      kycEmailLastAction: action,
      kycEmailLastError: error,
    },
    select: {
      kycEmailLastSentAt: true,
      kycEmailLastStatus: true,
      kycEmailLastAction: true,
      kycEmailLastError: true,
    },
  });

export const getAllUsers = async (req, res) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (role) filters.role = role;
    if (isActive !== undefined) filters.isActive = isActive === "true";
    if (search) {
      filters.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: filters,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          isVerified: true,
          phoneNumber: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where: filters }),
    ]);

    return res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, role, isVerified } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent admin from disabling themselves
    if (id === req.user.id && isActive === false) {
      return res
        .status(400)
        .json({ message: "You cannot disable your own account" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(role && { role }),
        ...(isVerified !== undefined && { isVerified }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
      },
    });

    return res
      .status(200)
      .json({ message: "User updated successfully", user: updated });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (status) filters.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: filters,
        include: {
          items: {
            include: { listing: { select: { id: true, title: true } } },
          },
          buyer: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.order.count({ where: filters }),
    ]);

    return res.status(200).json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalListings,
      totalOrders,
      totalBarterRequests,
      recentOrders,
      usersByRole,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count(),
      prisma.order.count(),
      prisma.barterRequest.count(),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          buyer: { select: { id: true, fullName: true } },
          items: { include: { listing: { select: { title: true } } } },
        },
      }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { role: true },
      }),
    ]);

    return res.status(200).json({
      stats: {
        totalUsers,
        totalListings,
        totalOrders,
        totalBarterRequests,
      },
      usersByRole,
      recentOrders,
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account" });
    }

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.user.delete({ where: { id } });

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description, iconUrl, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        iconUrl,
        parentId: parentId ?? null,
      },
    });

    return res
      .status(201)
      .json({ message: "Category created successfully", category });
  } catch (error) {
    console.error("Create category error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: {
        children: {
          where: { isActive: true },
          select: { id: true, name: true, description: true, iconUrl: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return res.status(200).json({ categories });
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, iconUrl, isActive } = req.body;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(iconUrl && { iconUrl }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return res
      .status(200)
      .json({ message: "Category updated successfully", category: updated });
  } catch (error) {
    console.error("Update category error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// KYC Management Endpoints
export const getPendingKYCSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const filters = { kycStatus: "PENDING", role: "FARMER" };
    if (search) {
      filters.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [submissions, total] = await Promise.all([
      prisma.user.findMany({
        where: filters,
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          region: true,
          nationalIdImageUrl: true,
          farmRegistrationImageUrl: true,
          businessCertificateImageUrl: true,
          kycStatus: true,
          kycSubmittedAt: true,
          createdAt: true,
        },
        orderBy: { kycSubmittedAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where: filters }),
    ]);

    return res.status(200).json({
      submissions: submissions.map(withSignedKycUrls),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get pending KYC submissions error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getReviewedKYCSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;

    const normalizedStatus = String(status || "").toUpperCase();
    const allowedStatuses = ["APPROVED", "REJECTED"];
    const filters = {
      role: "FARMER",
      kycStatus:
        normalizedStatus && allowedStatuses.includes(normalizedStatus)
          ? normalizedStatus
          : { in: allowedStatuses },
    };

    if (search) {
      filters.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [submissions, total] = await Promise.all([
      prisma.user.findMany({
        where: filters,
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          region: true,
          nationalIdImageUrl: true,
          farmRegistrationImageUrl: true,
          businessCertificateImageUrl: true,
          kycStatus: true,
          kycRejectReason: true,
          kycSubmittedAt: true,
          kycApprovedAt: true,
          kycEmailLastSentAt: true,
          kycEmailLastStatus: true,
          kycEmailLastAction: true,
          kycEmailLastError: true,
          createdAt: true,
        },
        orderBy: [{ kycApprovedAt: "desc" }, { kycSubmittedAt: "desc" }],
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where: filters }),
    ]);

    return res.status(200).json({
      submissions: submissions.map(withSignedKycUrls),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get reviewed KYC submissions error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const approveKYC = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.kycStatus === "APPROVED") {
      return res
        .status(400)
        .json({ message: "KYC already approved for this user" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: "APPROVED",
        kycApprovedAt: new Date(),
        kycRejectReason: null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        kycStatus: true,
        kycApprovedAt: true,
        kycRejectReason: true,
        kycEmailLastSentAt: true,
        kycEmailLastStatus: true,
        kycEmailLastAction: true,
        kycEmailLastError: true,
      },
    });

    let emailNotificationSent = true;
    let emailErrorMessage = null;
    try {
      await sendKYCStatusEmail(
        updated.email,
        updated.fullName,
        updated.kycStatus,
      );
    } catch (emailError) {
      emailNotificationSent = false;
      emailErrorMessage =
        emailError.message || "Failed to send KYC approval email";
      console.error("Approve KYC email error:", emailError);
    }

    const emailAudit = await updateKYCEmailAudit({
      userId,
      status: updated.kycStatus,
      action: KYC_EMAIL_ACTIONS.APPROVE,
      error: emailErrorMessage,
    });

    return res.status(200).json({
      message: "KYC approved successfully",
      user: { ...updated, ...emailAudit },
      emailNotificationSent,
    });
  } catch (error) {
    console.error("Approve KYC error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const rejectKYC = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const trimmedReason = String(reason || "").trim();

    if (!trimmedReason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: "REJECTED",
        kycRejectReason: trimmedReason,
        kycApprovedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        kycStatus: true,
        kycRejectReason: true,
        kycEmailLastSentAt: true,
        kycEmailLastStatus: true,
        kycEmailLastAction: true,
        kycEmailLastError: true,
      },
    });

    let emailNotificationSent = true;
    let emailErrorMessage = null;
    try {
      await sendKYCStatusEmail(
        updated.email,
        updated.fullName,
        updated.kycStatus,
        updated.kycRejectReason,
      );
    } catch (emailError) {
      emailNotificationSent = false;
      emailErrorMessage =
        emailError.message || "Failed to send KYC rejection email";
      console.error("Reject KYC email error:", emailError);
    }

    const emailAudit = await updateKYCEmailAudit({
      userId,
      status: updated.kycStatus,
      action: KYC_EMAIL_ACTIONS.REJECT,
      error: emailErrorMessage,
    });

    return res.status(200).json({
      message: "KYC rejected successfully",
      user: { ...updated, ...emailAudit },
      emailNotificationSent,
    });
  } catch (error) {
    console.error("Reject KYC error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getKYCStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        region: true,
        nationalIdImageUrl: true,
        farmRegistrationImageUrl: true,
        businessCertificateImageUrl: true,
        kycStatus: true,
        kycRejectReason: true,
        kycSubmittedAt: true,
        kycApprovedAt: true,
        kycEmailLastSentAt: true,
        kycEmailLastStatus: true,
        kycEmailLastAction: true,
        kycEmailLastError: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: withSignedKycUrls(user) });
  } catch (error) {
    console.error("Get KYC status error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resendKYCDecisionEmail = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        kycStatus: true,
        kycRejectReason: true,
        kycEmailLastSentAt: true,
        kycEmailLastStatus: true,
        kycEmailLastAction: true,
        kycEmailLastError: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!["APPROVED", "REJECTED"].includes(user.kycStatus)) {
      return res.status(400).json({
        message:
          "KYC email can only be resent for approved or rejected submissions",
      });
    }

    try {
      await sendKYCStatusEmail(
        user.email,
        user.fullName,
        user.kycStatus,
        user.kycRejectReason,
      );
    } catch (emailError) {
      console.error("Resend KYC email error:", emailError);
      const emailAudit = await updateKYCEmailAudit({
        userId,
        status: user.kycStatus,
        action: KYC_EMAIL_ACTIONS.RESEND,
        error: emailError.message || "Failed to resend KYC decision email",
      });
      return res.status(200).json({
        message:
          emailError.message || "KYC decision email could not be delivered",
        emailNotificationSent: false,
        user: { ...user, ...emailAudit },
      });
    }

    const emailAudit = await updateKYCEmailAudit({
      userId,
      status: user.kycStatus,
      action: KYC_EMAIL_ACTIONS.RESEND,
      error: null,
    });

    return res.status(200).json({
      message: "KYC decision email resent successfully",
      emailNotificationSent: true,
      user: { ...user, ...emailAudit },
    });
  } catch (error) {
    console.error("Resend KYC decision email error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

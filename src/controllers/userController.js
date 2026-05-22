import prisma from "../config/prisma.js";

const parsePagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(query.limit, 10) || 10),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const getUserStats = async (userId) => {
  const [totalListings, completedSales, reviewsAggregate, totalReviews] =
    await Promise.all([
      prisma.listing.count({ where: { sellerId: userId } }),
      prisma.order.count({
        where: {
          status: "DELIVERED",
          items: { some: { listing: { sellerId: userId } } },
        },
      }),
      prisma.review.aggregate({
        where: { reviewedUserId: userId },
        _avg: { rating: true },
      }),
      prisma.review.count({ where: { reviewedUserId: userId } }),
    ]);

  return {
    totalListings,
    completedSales,
    totalReviews,
    averageRating: Number(reviewsAggregate?._avg?.rating || 0),
  };
};

export const getPublicUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        fullName: true,
        role: true,
        region: true,
        profilePhotoUrl: true,
        isVerified: true,
        kycStatus: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [stats, portfolio] = await Promise.all([
      getUserStats(user.id),
      prisma.listing.findMany({
        where: { sellerId: user.id },
        select: {
          id: true,
          title: true,
          pricePerUnit: true,
          unit: true,
          quantityAvailable: true,
          status: true,
          createdAt: true,
          category: { select: { id: true, name: true } },
          images: {
            select: {
              id: true,
              imageUrl: true,
              isPrimary: true,
              sortOrder: true,
            },
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 3,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    const profile = {
      ...user,
      verificationBadge:
        user.isVerified &&
        (user.role !== "FARMER" || user.kycStatus === "APPROVED"),
    };

    return res.status(200).json({ profile, stats, portfolio });
  } catch (error) {
    console.error("Get public user profile error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getPublicUserStats = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, isActive: true },
      select: { id: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const stats = await getUserStats(user.id);

    return res.status(200).json({
      stats: {
        ...stats,
        memberSince: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get public user stats error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getPublicUserReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, skip } = parsePagination(req.query);

    const user = await prisma.user.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { reviewedUserId: user.id },
        select: {
          id: true,
          rating: true,
          comment: true,
          type: true,
          createdAt: true,
          reviewer: {
            select: {
              id: true,
              fullName: true,
              profilePhotoUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { reviewedUserId: user.id } }),
    ]);

    return res.status(200).json({
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Get public user reviews error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

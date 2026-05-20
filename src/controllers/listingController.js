import prisma from "../config/prisma.js";

export const createListing = async (req, res) => {
  try {
    const {
      title,
      description,
      pricePerUnit,
      quantity,
      unit,
      location,
      categoryId,
      listingType,
    } = req.body;

    const requiredFields = {
      title,
      pricePerUnit,
      quantity,
      unit,
      location,
      listingType,
    };
    const missingFields = Object.keys(requiredFields).filter(
      (key) => !requiredFields[key],
    );
    if (missingFields.length > 0) {
      return res
        .status(400)
        .json({
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const listing = await prisma.listing.create({
      data: {
        title,
        description,
        pricePerUnit: parseFloat(pricePerUnit),
        quantity: parseFloat(quantity),
        quantityAvailable: parseFloat(quantity),
        unit,
        location,
        listingType,
        categoryId: categoryId ?? null,
        sellerId: req.user.id,
      },
      include: {
        seller: { select: { id: true, fullName: true, email: true } },
        category: true,
      },
    });

    return res
      .status(201)
      .json({ message: "Listing created successfully", listing });
  } catch (error) {
    console.error("Create listing error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllListings = async (req, res) => {
  try {
    const {
      category,
      listingType,
      location,
      minPrice,
      maxPrice,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filters = { status: "ACTIVE" };

    // Validate and apply category filter
    if (category && category.trim()) {
      filters.categoryId = category.trim();
    }

    if (listingType) filters.listingType = listingType;

    if (location)
      filters.location = { contains: location, mode: "insensitive" };

    if (search) {
      filters.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { seller: { fullName: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Validate and apply price filters
    if (minPrice || maxPrice) {
      filters.pricePerUnit = {};

      const minPriceNum = minPrice ? parseFloat(minPrice) : null;
      const maxPriceNum = maxPrice ? parseFloat(maxPrice) : null;

      if (minPriceNum !== null && !isNaN(minPriceNum) && minPriceNum >= 0) {
        filters.pricePerUnit.gte = minPriceNum;
      }
      if (maxPriceNum !== null && !isNaN(maxPriceNum) && maxPriceNum >= 0) {
        filters.pricePerUnit.lte = maxPriceNum;
      }
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where: filters,
        include: {
          seller: { select: { id: true, fullName: true } },
          category: { select: { id: true, name: true } },
          images: { take: 1 },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.listing.count({ where: filters }),
    ]);

    return res.status(200).json({
      listings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get listings error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getListingById = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, fullName: true, email: true } },
        category: true,
        images: true,
        // reviews: {
        //   include: { reviewer: { select: { id: true, fullName: true } } }
        // }
      },
    });

    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    return res.status(200).json({ listing });
  } catch (error) {
    console.error("Get listing error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      pricePerUnit,
      quantity,
      quantityAvailable,
      unit,
      location,
      categoryId,
      listingType,
      status,
    } = req.body;

    const listing = await prisma.listing.findUnique({ where: { id } });

    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (listing.sellerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only update your own listings" });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(pricePerUnit && { pricePerUnit: parseFloat(pricePerUnit) }),
        ...(quantity && { quantity: parseFloat(quantity) }),
        ...(quantityAvailable && {
          quantityAvailable: parseFloat(quantityAvailable),
        }),
        ...(unit && { unit }),
        ...(location && { location }),
        ...(listingType && { listingType }),
        ...(categoryId && { categoryId }),
        ...(status && { status }),
      },
      include: {
        seller: { select: { id: true, fullName: true } },
        category: true,
      },
    });

    return res
      .status(200)
      .json({ message: "Listing updated successfully", listing: updated });
  } catch (error) {
    console.error("Update listing error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await prisma.listing.findUnique({ where: { id } });

    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (listing.sellerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only delete your own listings" });
    }

    await prisma.listing.delete({ where: { id } });

    return res.status(200).json({ message: "Listing deleted successfully" });
  } catch (error) {
    console.error("Delete listing error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const uploadListingImages = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await prisma.listing.findUnique({ where: { id } });

    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (listing.sellerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only upload images to your own listings" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    const images = await Promise.all(
      req.files.map((file, index) =>
        prisma.listingImage.create({
          data: {
            imageUrl: file.path,
            isPrimary: index === 0,
            sortOrder: index,
            listingId: id,
          },
        }),
      ),
    );

    return res
      .status(201)
      .json({ message: "Images uploaded successfully", images });
  } catch (error) {
    console.error("Upload listing images error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

import prisma from "../config/prisma.js";

const ALLOWED_UNITS = ["KG", "BAG", "CRATE", "PIECE", "LITRE", "BUNDLE"];
const ALLOWED_LISTING_TYPES = ["SELL", "BARTER", "BOTH"];
const CSV_ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  if (typeof value === "number") return value === 1;
  return false;
};

const parsePositiveNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseHarvestDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const resolveListingStatus = ({ isDraft, status }) => {
  if (parseBoolean(isDraft)) return "PAUSED";
  if (typeof status === "string" && status.trim()) {
    const normalized = status.trim().toUpperCase();
    if (["ACTIVE", "PAUSED", "SOLD", "EXPIRED"].includes(normalized)) {
      return normalized;
    }
  }
  return "ACTIVE";
};

const parseCsvRows = (csvContent = "") => {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const parseLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce((acc, key, index) => {
      acc[key] = values[index] ?? "";
      return acc;
    }, {});
  });

  return { headers, rows };
};

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
      harvestDate,
      minimumOrderQty,
      negotiable,
      isDraft,
      status,
    } = req.body;

    const resolvedStatus = resolveListingStatus({ isDraft, status });
    const isDraftListing = resolvedStatus === "PAUSED";
    const parsedPrice = parsePositiveNumber(pricePerUnit);
    const parsedQuantity = parsePositiveNumber(quantity);
    const parsedMinimumOrderQty = parsePositiveNumber(minimumOrderQty);
    const parsedHarvestDate = parseHarvestDate(harvestDate);

    const normalizedUnit =
      typeof unit === "string" ? unit.trim().toUpperCase() : "";
    const normalizedListingType =
      typeof listingType === "string"
        ? listingType.trim().toUpperCase()
        : "SELL";

    const requiredFields = {
      title,
      categoryId,
      ...(isDraftListing
        ? {}
        : {
            pricePerUnit: parsedPrice,
            quantity: parsedQuantity,
            unit: normalizedUnit,
            location,
            listingType: normalizedListingType,
          }),
    };
    const missingFields = Object.keys(requiredFields).filter(
      (key) => !requiredFields[key],
    );
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    if (normalizedUnit && !ALLOWED_UNITS.includes(normalizedUnit)) {
      return res.status(400).json({ message: "Invalid unit provided" });
    }

    if (
      normalizedListingType &&
      !ALLOWED_LISTING_TYPES.includes(normalizedListingType)
    ) {
      return res.status(400).json({ message: "Invalid listing type provided" });
    }

    if (harvestDate && !parsedHarvestDate) {
      return res.status(400).json({ message: "Invalid harvest date" });
    }

    if (minimumOrderQty !== undefined && !parsedMinimumOrderQty) {
      return res
        .status(400)
        .json({ message: "Invalid minimum order quantity" });
    }

    if (
      parsedMinimumOrderQty &&
      parsedQuantity &&
      parsedMinimumOrderQty > parsedQuantity
    ) {
      return res.status(400).json({
        message: "Minimum order quantity cannot exceed available quantity",
      });
    }

    const listing = await prisma.listing.create({
      data: {
        title: title.trim(),
        description,
        pricePerUnit: parsedPrice ?? 0.01,
        quantity: parsedQuantity ?? 0.01,
        quantityAvailable: parsedQuantity ?? 0.01,
        unit: normalizedUnit || "KG",
        location: location?.trim() || "Draft",
        listingType: normalizedListingType || "SELL",
        categoryId,
        negotiable: parseBoolean(negotiable),
        ...(parsedMinimumOrderQty && {
          minimumOrderQty: parsedMinimumOrderQty,
        }),
        status: resolvedStatus,
        ...(parsedHarvestDate && { harvestDate: parsedHarvestDate }),
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
      status,
      ownerId,
      mine,
      page = 1,
      limit = 20,
    } = req.query;

    const filters = {};
    const includeOwnListings = parseBoolean(mine) || !!ownerId;

    if (!includeOwnListings) {
      filters.status = "ACTIVE";
    }

    if (ownerId) {
      filters.sellerId = ownerId;
    }

    if (status && typeof status === "string") {
      const normalizedStatus = status.trim().toUpperCase();
      if (["ACTIVE", "PAUSED", "SOLD", "EXPIRED"].includes(normalizedStatus)) {
        filters.status = normalizedStatus;
      }
    }

    // Validate and apply category filter
    if (category && category.trim()) {
      filters.categoryId = category.trim();
    }

    if (listingType) {
      const normalizedListingType = String(listingType).trim().toUpperCase();
      if (ALLOWED_LISTING_TYPES.includes(normalizedListingType)) {
        filters.listingType = normalizedListingType;
      }
    }

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
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
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
      harvestDate,
      minimumOrderQty,
      negotiable,
      isDraft,
      publish,
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

    const parsedHarvestDate = parseHarvestDate(harvestDate);
    const parsedMinimumOrderQty = parsePositiveNumber(minimumOrderQty);
    const parsedQuantity = parsePositiveNumber(quantity);

    if (minimumOrderQty !== undefined && !parsedMinimumOrderQty) {
      return res
        .status(400)
        .json({ message: "Invalid minimum order quantity" });
    }

    if (
      parsedMinimumOrderQty &&
      parsedQuantity &&
      parsedMinimumOrderQty > parsedQuantity
    ) {
      return res.status(400).json({
        message: "Minimum order quantity cannot exceed available quantity",
      });
    }

    const targetStatus = parseBoolean(publish)
      ? "ACTIVE"
      : resolveListingStatus({ isDraft, status: status || listing.status });

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
        ...(minimumOrderQty !== undefined && {
          minimumOrderQty: parsedMinimumOrderQty,
        }),
        ...(negotiable !== undefined && {
          negotiable: parseBoolean(negotiable),
        }),
        ...(harvestDate !== undefined && { harvestDate: parsedHarvestDate }),
        ...(targetStatus && { status: targetStatus }),
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

export const bulkUploadListings = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const mimeType = String(req.file?.mimetype || "").toLowerCase();
    if (!CSV_ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ message: "Unsupported CSV file type" });
    }

    const fileName = String(req.file.originalname || "").toLowerCase();
    if (!fileName.endsWith(".csv")) {
      return res.status(400).json({ message: "Only CSV files are supported" });
    }

    const csvContent = req.file.buffer.toString("utf-8");
    const { rows } = parseCsvRows(csvContent);

    if (!rows.length) {
      return res.status(400).json({ message: "CSV has no data rows" });
    }

    const results = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNumber = i + 2;

      const title = row.title?.trim();
      const categoryId = row.categoryid?.trim();
      const location = row.location?.trim();
      const unit = row.unit?.trim().toUpperCase() || "KG";
      const listingType = row.listingtype?.trim().toUpperCase() || "SELL";
      const pricePerUnit = parsePositiveNumber(row.priceperunit);
      const quantity = parsePositiveNumber(row.quantity);
      const harvestDate = parseHarvestDate(row.harvestdate);
      const minimumOrderQty = parsePositiveNumber(row.minimumorderqty);
      const negotiable = parseBoolean(row.negotiable);
      const isDraft = parseBoolean(row.isdraft);

      const rowErrors = [];
      if (!title) rowErrors.push("title is required");
      if (!categoryId) rowErrors.push("categoryId is required");
      if (!location && !isDraft) rowErrors.push("location is required");
      if (!pricePerUnit && !isDraft) rowErrors.push("pricePerUnit must be > 0");
      if (!quantity && !isDraft) rowErrors.push("quantity must be > 0");
      if (!ALLOWED_UNITS.includes(unit)) rowErrors.push("invalid unit");
      if (!ALLOWED_LISTING_TYPES.includes(listingType))
        rowErrors.push("invalid listingType");
      if (row.harvestdate && !harvestDate)
        rowErrors.push("invalid harvestDate");
      if (row.minimumorderqty && !minimumOrderQty)
        rowErrors.push("invalid minimumOrderQty");
      if (minimumOrderQty && quantity && minimumOrderQty > quantity) {
        rowErrors.push("minimumOrderQty cannot exceed quantity");
      }

      if (rowErrors.length > 0) {
        results.push({ row: rowNumber, status: "failed", errors: rowErrors });
        continue;
      }

      try {
        const created = await prisma.listing.create({
          data: {
            title,
            description: row.description?.trim() || title,
            pricePerUnit: pricePerUnit ?? 0.01,
            quantity: quantity ?? 0.01,
            quantityAvailable: quantity ?? 0.01,
            unit,
            location: location || "Draft",
            categoryId,
            listingType,
            negotiable,
            ...(minimumOrderQty && { minimumOrderQty }),
            status: isDraft ? "PAUSED" : "ACTIVE",
            ...(harvestDate && { harvestDate }),
            sellerId: req.user.id,
          },
          select: { id: true, title: true, status: true },
        });

        results.push({ row: rowNumber, status: "created", listing: created });
      } catch (error) {
        results.push({
          row: rowNumber,
          status: "failed",
          errors: [error?.message || "Failed to create listing"],
        });
      }
    }

    const createdCount = results.filter(
      (result) => result.status === "created",
    ).length;
    const failedCount = results.length - createdCount;

    return res.status(200).json({
      message: "CSV processing completed",
      summary: {
        totalRows: results.length,
        createdCount,
        failedCount,
      },
      results,
    });
  } catch (error) {
    console.error("Bulk upload listings error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

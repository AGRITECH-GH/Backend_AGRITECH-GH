import { Router } from "express";
import { authenticate, authorize } from "../middleware/authenticate.js";
import { uploadListingImages as uploadMiddleware } from "../middleware/upload.js";
import multer from "multer";
import {
  createListing,
  getAllListings,
  getListingById,
  updateListing,
  deleteListing,
  uploadListingImages,
  bulkUploadListings,
} from "../controllers/listingController.js";
import { requireVerified } from "../middleware/requireVerified.js";
const router = Router();
const CSV_ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const fileName = String(file?.originalname || "").toLowerCase();
    const isCsvName = fileName.endsWith(".csv");
    const isCsvMime = CSV_ALLOWED_MIME_TYPES.has(file?.mimetype);

    if (!isCsvName || !isCsvMime) {
      return cb(new Error("Only CSV files are allowed"));
    }

    return cb(null, true);
  },
});

router.post(
  "/",
  authenticate,
  requireVerified,
  authorize("FARMER", "AGENT"),
  createListing,
);
router.post(
  "/bulk-upload",
  authenticate,
  requireVerified,
  authorize("FARMER", "AGENT"),
  csvUpload.single("file"),
  bulkUploadListings,
);
router.get("/", getAllListings);
router.get("/:id", getListingById);
router.put("/:id", authenticate, authorize("FARMER", "AGENT"), updateListing);
router.delete(
  "/:id",
  authenticate,
  authorize("FARMER", "AGENT"),
  deleteListing,
);
router.post(
  "/:id/images",
  authenticate,
  authorize("FARMER", "AGENT"),
  uploadMiddleware,
  uploadListingImages,
);

export default router;

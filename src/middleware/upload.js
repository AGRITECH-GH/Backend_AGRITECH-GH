import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_KYC_MIME_TYPES = new Set([
  ...ALLOWED_IMAGE_MIME_TYPES,
  "application/pdf",
]);

const createFileFilter = (allowedTypes, errorMessage) => (req, file, cb) => {
  if (!allowedTypes.has(file?.mimetype)) {
    return cb(new Error(errorMessage));
  }
  return cb(null, true);
};

const listingStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "FarmBridge/listings",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

const barterStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "FarmBridge/barter",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

export const uploadProfilePhoto = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "FarmBridge/profiles",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
      ],
    },
  }),
  fileFilter: createFileFilter(
    ALLOWED_IMAGE_MIME_TYPES,
    "Only JPG, PNG, and WEBP images are allowed",
  ),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
}).single("photo");

export const uploadListingImages = multer({
  storage: listingStorage,
  fileFilter: createFileFilter(
    ALLOWED_IMAGE_MIME_TYPES,
    "Only JPG, PNG, and WEBP images are allowed",
  ),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).array("images", 5);

export const uploadBarterImages = multer({
  storage: barterStorage,
  fileFilter: createFileFilter(
    ALLOWED_IMAGE_MIME_TYPES,
    "Only JPG, PNG, and WEBP images are allowed",
  ),
  limits: { fileSize: 5 * 1024 * 1024 },
}).array("images", 3);

export const uploadKYCDocuments = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "FarmBridge/kyc",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"],
      resource_type: "auto",
      // KYC documents contain national IDs and business papers — deliver as
      // authenticated assets so the raw URL returns 401 without a signature.
      // Serve them via signKycUrl() (src/utils/kycUrl.js) which generates
      // signed delivery URLs for authorised viewers only.
      type: "authenticated",
      transformation: [{ width: 1000, crop: "limit" }],
    },
  }),
  fileFilter: createFileFilter(
    ALLOWED_KYC_MIME_TYPES,
    "Only JPG, PNG, WEBP, and PDF files are allowed",
  ),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per document
}).fields([
  { name: "nationalId", maxCount: 1 },
  { name: "farmRegistration", maxCount: 1 },
  { name: "businessCertificate", maxCount: 1 },
]);

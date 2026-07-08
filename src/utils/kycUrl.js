/**
 * @file kycUrl.js
 * @description Signed delivery URLs for KYC documents.
 *
 * KYC documents (national IDs, farm registrations, business certificates)
 * are uploaded to Cloudinary as `type: "authenticated"` assets — their plain
 * delivery URL returns 401. This helper converts the stored upload URL into
 * a signed URL that authorised viewers (admins, the owning farmer) can open.
 *
 * Legacy assets uploaded before this change are plain public `/upload/` URLs;
 * they are returned unchanged so existing records keep working.
 */

import cloudinary from "../config/cloudinary.js";

const AUTHENTICATED_URL_RE =
  /^https?:\/\/res\.cloudinary\.com\/[^/]+\/([^/]+)\/authenticated\/(?:s--[^/]+--\/)?v\d+\/(.+)$/;

/**
 * Convert a stored KYC document URL into a signed, viewable delivery URL.
 *
 * @param {string|null} storedUrl - Value persisted on the user record
 * @returns {string|null} Signed URL for authenticated assets, the original
 *   URL for legacy public assets, or null when input is empty.
 */
export const signKycUrl = (storedUrl) => {
  if (!storedUrl || typeof storedUrl !== "string") return storedUrl ?? null;

  const match = storedUrl.match(AUTHENTICATED_URL_RE);
  if (!match) {
    // Legacy public upload (or non-Cloudinary value) — return unchanged
    return storedUrl;
  }

  const [, resourceType, publicIdWithExt] = match;

  return cloudinary.url(publicIdWithExt, {
    resource_type: resourceType,
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
};

/**
 * Return a shallow copy of a user-like object with its KYC document URL
 * fields replaced by signed URLs. Non-KYC fields are untouched.
 *
 * @param {object|null} user
 * @returns {object|null}
 */
export const withSignedKycUrls = (user) => {
  if (!user || typeof user !== "object") return user;
  return {
    ...user,
    ...(user.nationalIdImageUrl !== undefined && {
      nationalIdImageUrl: signKycUrl(user.nationalIdImageUrl),
    }),
    ...(user.farmRegistrationImageUrl !== undefined && {
      farmRegistrationImageUrl: signKycUrl(user.farmRegistrationImageUrl),
    }),
    ...(user.businessCertificateImageUrl !== undefined && {
      businessCertificateImageUrl: signKycUrl(user.businessCertificateImageUrl),
    }),
  };
};

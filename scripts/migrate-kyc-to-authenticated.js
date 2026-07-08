/**
 * @file migrate-kyc-to-authenticated.js
 * @description One-off migration: convert legacy PUBLIC KYC documents in
 * Cloudinary to `type: "authenticated"` delivery, and update the stored URL
 * on each user record.
 *
 * Background: KYC uploads (national IDs, farm registrations, business
 * certificates) were originally uploaded with public delivery — anyone with
 * the URL could open them. New uploads are authenticated (see
 * src/middleware/upload.js); this script migrates the assets that already
 * exist.
 *
 * Usage:
 *   node --experimental-specifier-resolution=node scripts/migrate-kyc-to-authenticated.js           # dry run (default) — reports what would change
 *   node --experimental-specifier-resolution=node scripts/migrate-kyc-to-authenticated.js --apply   # perform the migration
 *
 * Or via npm:
 *   npm run migrate:kyc          # dry run
 *   npm run migrate:kyc -- --apply
 *
 * Behaviour:
 * - Only touches assets under the FarmBridge/kyc folder — profile photos and
 *   listing images are never modified.
 * - Idempotent: URLs already on authenticated delivery are skipped, and the
 *   DB is only updated after Cloudinary confirms the rename, so the script
 *   can be safely re-run after a partial failure.
 * - Per-asset errors (e.g. asset deleted from Cloudinary) are logged and
 *   skipped; the run continues.
 */

import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "../prisma/prisma-client-js/index.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

const KYC_FIELDS = [
  "nationalIdImageUrl",
  "farmRegistrationImageUrl",
  "businessCertificateImageUrl",
];

// Legacy public delivery URL for a KYC asset.
// Captures: [1] resource_type, [2] public path after the version segment.
const LEGACY_KYC_URL_RE =
  /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(FarmBridge\/kyc\/.+)$/;

/**
 * Derive the Cloudinary public_id from the URL path segment.
 * For image/video assets the file extension is a delivery format and is NOT
 * part of the public_id; for raw assets the extension IS part of it.
 */
const toPublicId = (pathSegment, resourceType) => {
  if (resourceType === "raw") return pathSegment;
  const lastDot = pathSegment.lastIndexOf(".");
  const lastSlash = pathSegment.lastIndexOf("/");
  return lastDot > lastSlash ? pathSegment.slice(0, lastDot) : pathSegment;
};

/**
 * Move one asset from public to authenticated delivery.
 * Returns the new secure URL, or null when the value needs no migration.
 * Throws on Cloudinary API failure.
 */
const migrateAsset = async (storedUrl, cache) => {
  if (!storedUrl || typeof storedUrl !== "string") return null;
  if (storedUrl.includes("/authenticated/")) return null; // already migrated

  const match = storedUrl.match(LEGACY_KYC_URL_RE);
  if (!match) return null; // not a legacy public KYC asset — leave untouched

  const [, resourceType, pathSegment] = match;
  const publicId = toPublicId(pathSegment, resourceType);

  // Same asset can appear on multiple fields/users; migrate once.
  const cacheKey = `${resourceType}:${publicId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  if (!APPLY) {
    cache.set(cacheKey, "(dry-run)");
    return "(dry-run)";
  }

  // Rename to the SAME public_id while switching delivery type. `invalidate`
  // purges the old public URL from Cloudinary's CDN cache.
  const result = await cloudinary.uploader.rename(publicId, publicId, {
    resource_type: resourceType,
    type: "upload",
    to_type: "authenticated",
    invalidate: true,
  });

  cache.set(cacheKey, result.secure_url);
  return result.secure_url;
};

const main = async () => {
  console.log(
    APPLY
      ? "[migrate-kyc] APPLY mode — assets will be moved to authenticated delivery."
      : "[migrate-kyc] DRY RUN — no changes will be made. Pass --apply to execute.",
  );

  const users = await prisma.user.findMany({
    where: {
      OR: KYC_FIELDS.map((field) => ({
        [field]: { contains: "/upload/" },
      })),
    },
    select: {
      id: true,
      email: true,
      nationalIdImageUrl: true,
      farmRegistrationImageUrl: true,
      businessCertificateImageUrl: true,
    },
  });

  console.log(`[migrate-kyc] ${users.length} user(s) with legacy public KYC URLs.`);

  const cache = new Map();
  let migrated = 0;
  let failed = 0;
  let skipped = 0;

  for (const user of users) {
    const updates = {};

    for (const field of KYC_FIELDS) {
      const storedUrl = user[field];
      try {
        const newUrl = await migrateAsset(storedUrl, cache);
        if (newUrl === null) {
          if (storedUrl) skipped += 1;
          continue;
        }
        migrated += 1;
        console.log(`  ${user.id} ${field}:`);
        console.log(`    from: ${storedUrl}`);
        console.log(`    to:   ${newUrl}`);
        if (APPLY) updates[field] = newUrl;
      } catch (err) {
        failed += 1;
        console.error(
          `  [ERROR] ${user.id} ${field}: ${err?.error?.message || err.message}`,
        );
      }
    }

    if (APPLY && Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: updates });
    }
  }

  console.log(
    `[migrate-kyc] Done. ${APPLY ? "Migrated" : "Would migrate"}: ${migrated}, skipped (already private / not KYC): ${skipped}, failed: ${failed}.`,
  );
  if (!APPLY && migrated > 0) {
    console.log("[migrate-kyc] Re-run with --apply to perform the migration.");
  }
  if (failed > 0) process.exitCode = 1;
};

main()
  .catch((err) => {
    console.error("[migrate-kyc] Fatal:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

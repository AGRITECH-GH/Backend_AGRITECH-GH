-- AlterTable - Replace simple KYC fields with image URLs and add status tracking
ALTER TABLE "User"
DROP COLUMN IF EXISTS "nationalIdNumber",
DROP COLUMN IF EXISTS "farmRegistrationNumber",
DROP COLUMN IF EXISTS "businessCertificateNumber",
ADD COLUMN "nationalIdImageUrl" VARCHAR(500),
ADD COLUMN "farmRegistrationImageUrl" VARCHAR(500),
ADD COLUMN "businessCertificateImageUrl" VARCHAR(500),
ADD COLUMN "kycStatus" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
ADD COLUMN "kycRejectReason" TEXT,
ADD COLUMN "kycSubmittedAt" TIMESTAMP(3),
ADD COLUMN "kycApprovedAt" TIMESTAMP(3);

-- CreateIndex for faster KYC status queries
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

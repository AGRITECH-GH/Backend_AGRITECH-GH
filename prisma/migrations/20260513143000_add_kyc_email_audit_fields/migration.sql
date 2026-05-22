-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "kycEmailLastSentAt" TIMESTAMP(3),
ADD COLUMN     "kycEmailLastStatus" "KYCStatus",
ADD COLUMN     "kycEmailLastAction" VARCHAR(20),
ADD COLUMN     "kycEmailLastError" TEXT;
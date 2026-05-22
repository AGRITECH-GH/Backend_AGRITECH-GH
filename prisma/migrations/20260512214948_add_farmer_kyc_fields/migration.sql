/*
  Warnings:

  - The `kycStatus` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "User_kycStatus_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "kycStatus",
ADD COLUMN     "kycStatus" "KYCStatus" NOT NULL DEFAULT 'PENDING';

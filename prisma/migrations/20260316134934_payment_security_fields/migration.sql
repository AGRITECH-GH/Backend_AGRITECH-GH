/*
  Warnings:

  - A unique constraint covering the columns `[paystackReference]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ipAddress" VARCHAR(45),
ADD COLUMN     "paystackReference" VARCHAR(100),
ADD COLUMN     "paystackResponse" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paystackReference_key" ON "Payment"("paystackReference");

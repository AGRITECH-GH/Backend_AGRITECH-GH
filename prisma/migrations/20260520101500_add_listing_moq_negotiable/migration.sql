-- AlterTable
ALTER TABLE "Listing"
ADD COLUMN "minimumOrderQty" DECIMAL(10, 2),
ADD COLUMN "negotiable" BOOLEAN NOT NULL DEFAULT false;

/*
  Warnings:

  - Added the required column `quantity` to the `Listing` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "quantity" DECIMAL(10,2) NOT NULL;

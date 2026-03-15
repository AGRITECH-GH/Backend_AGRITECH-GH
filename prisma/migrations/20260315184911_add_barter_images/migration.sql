-- CreateTable
CREATE TABLE "BarterImage" (
    "id" SERIAL NOT NULL,
    "imageUrl" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "barterRequestId" INTEGER NOT NULL,

    CONSTRAINT "BarterImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BarterImage" ADD CONSTRAINT "BarterImage_barterRequestId_fkey" FOREIGN KEY ("barterRequestId") REFERENCES "BarterRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

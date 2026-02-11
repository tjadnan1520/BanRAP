-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "label_reviews" (
    "reviewID" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labelID" TEXT NOT NULL,
    "adminID" TEXT,

    CONSTRAINT "label_reviews_pkey" PRIMARY KEY ("reviewID")
);

-- CreateIndex
CREATE UNIQUE INDEX "label_reviews_labelID_key" ON "label_reviews"("labelID");

-- AddForeignKey
ALTER TABLE "label_reviews" ADD CONSTRAINT "label_reviews_labelID_fkey" FOREIGN KEY ("labelID") REFERENCES "labels"("labelID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_reviews" ADD CONSTRAINT "label_reviews_adminID_fkey" FOREIGN KEY ("adminID") REFERENCES "admins"("adminID") ON DELETE SET NULL ON UPDATE CASCADE;

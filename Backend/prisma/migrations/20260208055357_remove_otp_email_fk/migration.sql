-- DropForeignKey
ALTER TABLE "otps" DROP CONSTRAINT "otps_email_fkey";

-- CreateIndex
CREATE INDEX "otps_email_idx" ON "otps"("email");

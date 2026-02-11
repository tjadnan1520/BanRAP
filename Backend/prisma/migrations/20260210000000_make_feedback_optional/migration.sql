-- AlterTable: Make segmentID and roadID optional in feedbacks table
-- Drop foreign key constraints first
ALTER TABLE "feedbacks" DROP CONSTRAINT IF EXISTS "feedbacks_roadID_fkey";
ALTER TABLE "feedbacks" DROP CONSTRAINT IF EXISTS "feedbacks_segmentID_fkey";

-- Alter columns to be nullable
ALTER TABLE "feedbacks" ALTER COLUMN "segmentID" DROP NOT NULL;
ALTER TABLE "feedbacks" ALTER COLUMN "roadID" DROP NOT NULL;

-- Re-add foreign key constraints with ON DELETE SET NULL
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_segmentID_fkey" FOREIGN KEY ("segmentID") REFERENCES "road_segments"("segmentID") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_roadID_fkey" FOREIGN KEY ("roadID") REFERENCES "roads"("roadID") ON DELETE SET NULL ON UPDATE CASCADE;

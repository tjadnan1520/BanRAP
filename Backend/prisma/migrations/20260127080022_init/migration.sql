-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRAVELLER', 'ANNOTATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('FEEDBACK', 'COMPLAINT', 'SUGGESTION');

-- CreateTable
CREATE TABLE "users" (
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "travellers" (
    "travellerID" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travellers_pkey" PRIMARY KEY ("travellerID")
);

-- CreateTable
CREATE TABLE "annotators" (
    "annotatorID" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "workArea" TEXT,
    "penaltyScore" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annotators_pkey" PRIMARY KEY ("annotatorID")
);

-- CreateTable
CREATE TABLE "admins" (
    "adminID" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("adminID")
);

-- CreateTable
CREATE TABLE "otps" (
    "otpID" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("otpID")
);

-- CreateTable
CREATE TABLE "roads" (
    "roadID" TEXT NOT NULL,
    "roadName" TEXT NOT NULL,
    "rStartCoord" TEXT NOT NULL,
    "rEndCoord" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "riskScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "annotatorID" TEXT NOT NULL,
    "adminID" TEXT,

    CONSTRAINT "roads_pkey" PRIMARY KEY ("roadID")
);

-- CreateTable
CREATE TABLE "road_segments" (
    "segmentID" TEXT NOT NULL,
    "sStartCoord" TEXT NOT NULL,
    "sEndCoord" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roadID" TEXT NOT NULL,

    CONSTRAINT "road_segments_pkey" PRIMARY KEY ("segmentID")
);

-- CreateTable
CREATE TABLE "labels" (
    "labelID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "segmentID" TEXT NOT NULL,
    "annotatorID" TEXT NOT NULL,
    "adminID" TEXT,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("labelID")
);

-- CreateTable
CREATE TABLE "roadsides" (
    "roadsideID" TEXT NOT NULL,
    "leftObject" TEXT,
    "rightObject" TEXT,
    "distanceObject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labelID" TEXT NOT NULL,

    CONSTRAINT "roadsides_pkey" PRIMARY KEY ("roadsideID")
);

-- CreateTable
CREATE TABLE "intersections" (
    "intersectionID" TEXT NOT NULL,
    "type" TEXT,
    "quality" TEXT,
    "channelisation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labelID" TEXT NOT NULL,

    CONSTRAINT "intersections_pkey" PRIMARY KEY ("intersectionID")
);

-- CreateTable
CREATE TABLE "speeds" (
    "speedID" TEXT NOT NULL,
    "speedLimit" TEXT,
    "management" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labelID" TEXT NOT NULL,

    CONSTRAINT "speeds_pkey" PRIMARY KEY ("speedID")
);

-- CreateTable
CREATE TABLE "star_ratings" (
    "ratingID" TEXT NOT NULL,
    "ratingValue" INTEGER NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "safetyScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "segmentID" TEXT NOT NULL,
    "roadID" TEXT NOT NULL,

    CONSTRAINT "star_ratings_pkey" PRIMARY KEY ("ratingID")
);

-- CreateTable
CREATE TABLE "navigation_routes" (
    "routeID" TEXT NOT NULL,
    "pathGeometry" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "eta" DOUBLE PRECISION NOT NULL,
    "safetyETA" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ratingID" TEXT NOT NULL,

    CONSTRAINT "navigation_routes_pkey" PRIMARY KEY ("routeID")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "feedbackID" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageURL" TEXT,
    "coordinates" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "feedbackType" "FeedbackType" NOT NULL DEFAULT 'COMPLAINT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assignedAnnotatorID" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "email" TEXT NOT NULL,
    "segmentID" TEXT NOT NULL,
    "roadID" TEXT NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("feedbackID")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notificationID" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notificationID")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "travellers_email_key" ON "travellers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "annotators_email_key" ON "annotators"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roadsides_labelID_key" ON "roadsides"("labelID");

-- CreateIndex
CREATE UNIQUE INDEX "intersections_labelID_key" ON "intersections"("labelID");

-- CreateIndex
CREATE UNIQUE INDEX "speeds_labelID_key" ON "speeds"("labelID");

-- AddForeignKey
ALTER TABLE "travellers" ADD CONSTRAINT "travellers_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotators" ADD CONSTRAINT "annotators_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otps" ADD CONSTRAINT "otps_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roads" ADD CONSTRAINT "roads_annotatorID_fkey" FOREIGN KEY ("annotatorID") REFERENCES "annotators"("annotatorID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roads" ADD CONSTRAINT "roads_adminID_fkey" FOREIGN KEY ("adminID") REFERENCES "admins"("adminID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_segments" ADD CONSTRAINT "road_segments_roadID_fkey" FOREIGN KEY ("roadID") REFERENCES "roads"("roadID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_segmentID_fkey" FOREIGN KEY ("segmentID") REFERENCES "road_segments"("segmentID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_annotatorID_fkey" FOREIGN KEY ("annotatorID") REFERENCES "annotators"("annotatorID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_adminID_fkey" FOREIGN KEY ("adminID") REFERENCES "admins"("adminID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadsides" ADD CONSTRAINT "roadsides_labelID_fkey" FOREIGN KEY ("labelID") REFERENCES "labels"("labelID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intersections" ADD CONSTRAINT "intersections_labelID_fkey" FOREIGN KEY ("labelID") REFERENCES "labels"("labelID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speeds" ADD CONSTRAINT "speeds_labelID_fkey" FOREIGN KEY ("labelID") REFERENCES "labels"("labelID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_ratings" ADD CONSTRAINT "star_ratings_segmentID_fkey" FOREIGN KEY ("segmentID") REFERENCES "road_segments"("segmentID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_ratings" ADD CONSTRAINT "star_ratings_roadID_fkey" FOREIGN KEY ("roadID") REFERENCES "roads"("roadID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_routes" ADD CONSTRAINT "navigation_routes_ratingID_fkey" FOREIGN KEY ("ratingID") REFERENCES "star_ratings"("ratingID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_segmentID_fkey" FOREIGN KEY ("segmentID") REFERENCES "road_segments"("segmentID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_roadID_fkey" FOREIGN KEY ("roadID") REFERENCES "roads"("roadID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

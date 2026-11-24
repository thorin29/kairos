-- Backpacking with the phone's GPS (v0.779): points from the Kairos app are
-- marked, each trip day keeps its hiking for the trip summary, and Home
-- Assistant zones get an icon and a colour for Family map.

ALTER TABLE "LocationPoint" ADD COLUMN IF NOT EXISTS "source" TEXT;

ALTER TABLE "BackpackDay" ADD COLUMN IF NOT EXISTS "distanceM" DOUBLE PRECISION;
ALTER TABLE "BackpackDay" ADD COLUMN IF NOT EXISTS "seconds" INTEGER;
ALTER TABLE "BackpackDay" ADD COLUMN IF NOT EXISTS "gainM" DOUBLE PRECISION;
ALTER TABLE "BackpackDay" ADD COLUMN IF NOT EXISTS "lossM" DOUBLE PRECISION;
ALTER TABLE "BackpackDay" ADD COLUMN IF NOT EXISTS "summarySent" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "PlacesZone" (
  "name" TEXT NOT NULL,
  "icon" TEXT,
  "color" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlacesZone_pkey" PRIMARY KEY ("name")
);

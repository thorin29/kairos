-- v0.795: Places page — visits kept for good, unconfirmed spots, and which
-- days have been written.
ALTER TABLE "PlaceName" ADD COLUMN IF NOT EXISTS "kind" TEXT;

CREATE TABLE IF NOT EXISTS "PlaceSpot" (
  "id" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "label" TEXT,
  "address" TEXT,
  "googlePlaceId" TEXT,
  "labelAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceSpot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlaceSpot_lat_lng_idx" ON "PlaceSpot"("lat", "lng");

CREATE TABLE IF NOT EXISTS "PlaceVisit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "arrivedAt" TIMESTAMP(3) NOT NULL,
  "leftAt" TIMESTAMP(3) NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "zone" TEXT,
  "placeNameId" TEXT,
  "altPlaceNameId" TEXT,
  "spotId" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceVisit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlaceVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlaceVisit_placeNameId_fkey" FOREIGN KEY ("placeNameId") REFERENCES "PlaceName"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlaceVisit_altPlaceNameId_fkey" FOREIGN KEY ("altPlaceNameId") REFERENCES "PlaceName"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlaceVisit_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "PlaceSpot"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlaceVisit_userId_day_idx" ON "PlaceVisit"("userId", "day");
CREATE INDEX IF NOT EXISTS "PlaceVisit_placeNameId_arrivedAt_idx" ON "PlaceVisit"("placeNameId", "arrivedAt");
CREATE INDEX IF NOT EXISTS "PlaceVisit_spotId_idx" ON "PlaceVisit"("spotId");
CREATE INDEX IF NOT EXISTS "PlaceVisit_zone_idx" ON "PlaceVisit"("zone");
CREATE INDEX IF NOT EXISTS "PlaceVisit_arrivedAt_idx" ON "PlaceVisit"("arrivedAt");

CREATE TABLE IF NOT EXISTS "PlaceSnapshot" (
  "userId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceSnapshot_pkey" PRIMARY KEY ("userId", "day")
);

-- Places (v0.757): cached Google answers, daily API counts, and when a saved
-- address was last geocoded.

ALTER TABLE "SavedAddress" ADD COLUMN IF NOT EXISTS "geocodedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PlaceLookup" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "googlePlaceId" TEXT,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaceLookup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlaceLookup_lat_lng_idx" ON "PlaceLookup"("lat", "lng");
CREATE INDEX IF NOT EXISTS "PlaceLookup_fetchedAt_idx" ON "PlaceLookup"("fetchedAt");

CREATE TABLE IF NOT EXISTS "PlacesApiUsage" (
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlacesApiUsage_pkey" PRIMARY KEY ("day", "kind")
);

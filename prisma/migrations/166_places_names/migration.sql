-- Places (v0.758): named spots, snapped drives, and Google's nearby candidates.

ALTER TABLE "PlaceLookup" ADD COLUMN IF NOT EXISTS "candidates" JSONB;

CREATE TABLE IF NOT EXISTS "PlaceName" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusM" INTEGER NOT NULL DEFAULT 100,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaceName_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlaceName_lat_lng_idx" ON "PlaceName"("lat", "lng");

DO $$ BEGIN
  ALTER TABLE "PlaceName" ADD CONSTRAINT "PlaceName_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SnappedPath" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "path" JSONB NOT NULL,
    "snapped" BOOLEAN NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SnappedPath_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SnappedPath_userId_startAt_endAt_key" ON "SnappedPath"("userId", "startAt", "endAt");
CREATE INDEX IF NOT EXISTS "SnappedPath_fetchedAt_idx" ON "SnappedPath"("fetchedAt");

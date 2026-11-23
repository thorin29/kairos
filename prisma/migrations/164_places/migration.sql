-- Places (v0.755): family locations pushed from Home Assistant.

CREATE TABLE IF NOT EXISTS "PlacesPerson" (
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlacesPerson_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlacesPerson_entityId_key" ON "PlacesPerson"("entityId");

DO $$ BEGIN
  ALTER TABLE "PlacesPerson" ADD CONSTRAINT "PlacesPerson_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "LocationPoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "courseDeg" DOUBLE PRECISION,
    "altitudeM" DOUBLE PRECISION,
    "battery" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationPoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LocationPoint_userId_at_key" ON "LocationPoint"("userId", "at");

DO $$ BEGIN
  ALTER TABLE "LocationPoint" ADD CONSTRAINT "LocationPoint_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

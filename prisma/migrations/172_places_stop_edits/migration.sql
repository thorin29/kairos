-- Family map (v0.769): corrections to a day — remove a stop, add a missed one.

CREATE TABLE IF NOT EXISTS "PlacesStopEdit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "name" TEXT,
  "address" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlacesStopEdit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlacesStopEdit_userId_at_idx" ON "PlacesStopEdit"("userId", "at");
DO $$ BEGIN
  ALTER TABLE "PlacesStopEdit" ADD CONSTRAINT "PlacesStopEdit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

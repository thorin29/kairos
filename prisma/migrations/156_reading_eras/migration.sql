-- v0.723: reading eras. Each era is one pass at the Bible; a closed era keeps a
-- snapshot of the chapters it reached.
CREATE TABLE IF NOT EXISTS "ReadingEra" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT,
  "startedAt" TIMESTAMP(3),
  "startedOn" DATE,
  "endedAt" TIMESTAMP(3),
  "endedOn" DATE,
  "snapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReadingEra_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ReadingEra_ownerId_idx" ON "ReadingEra"("ownerId");
DO $$ BEGIN
  ALTER TABLE "ReadingEra" ADD CONSTRAINT "ReadingEra_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Companion collection: which creatures each person has hatched (no duplicates),
-- which is active, and their incubation progress. Choices/events, not derivable
-- from history, so they need storage. Idempotent.

CREATE TABLE IF NOT EXISTS "Companion" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "species"      TEXT NOT NULL,
  "shiny"        BOOLEAN NOT NULL DEFAULT false,
  "isActive"     BOOLEAN NOT NULL DEFAULT false,
  "activeSinceXp" INTEGER NOT NULL DEFAULT 0,
  "mintedStage"  INTEGER,
  "acquiredAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Companion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanionState" (
  "userId"           TEXT NOT NULL,
  "incubationBaseXp" INTEGER NOT NULL DEFAULT 0,
  "eggsHatched"      INTEGER NOT NULL DEFAULT 0,
  "seasonKey"        TEXT,
  "eggsThisSeason"   INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CompanionState_pkey" PRIMARY KEY ("userId")
);

-- No duplicate species per person.
CREATE UNIQUE INDEX IF NOT EXISTS "Companion_userId_species_key" ON "Companion"("userId", "species");
CREATE INDEX IF NOT EXISTS "Companion_userId_idx" ON "Companion"("userId");

DO $$ BEGIN
  ALTER TABLE "Companion" ADD CONSTRAINT "Companion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CompanionState" ADD CONSTRAINT "CompanionState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

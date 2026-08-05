-- Household-wide pauses (vacations). No chores are generated for covered days,
-- so those days also leave scoring; a multi-day all-day event marks the break.
DO $$ BEGIN
  CREATE TYPE "PauseType" AS ENUM ('VACATION', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Pause" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PauseType" NOT NULL DEFAULT 'VACATION',
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "eventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pause_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Pause_startDate_endDate_idx" ON "Pause"("startDate", "endDate");

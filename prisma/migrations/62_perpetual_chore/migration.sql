-- A "throughout the day" chore (e.g. take out the garbage, refill the water):
-- always available, tapped each time someone does it, countable per day. Logged
-- separately from scheduled tasks so it can be done many times a day. Idempotent.

ALTER TABLE "Chore" ADD COLUMN IF NOT EXISTS "perpetual" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ChoreLog" (
  "id"        TEXT NOT NULL,
  "choreId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "day"       DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChoreLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChoreLog_choreId_day_idx" ON "ChoreLog"("choreId", "day");
CREATE INDEX IF NOT EXISTS "ChoreLog_day_idx" ON "ChoreLog"("day");

DO $$ BEGIN
  ALTER TABLE "ChoreLog" ADD CONSTRAINT "ChoreLog_choreId_fkey"
    FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChoreLog" ADD CONSTRAINT "ChoreLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Backpacking (v0.778): an event type for trips, and each person's trip days
-- (their answer to "Hiking today?" and the workout logged for the day).

ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "backpacking" BOOLEAN NOT NULL DEFAULT false;

-- The Backpacking type, unless the household already has one by that name
-- (then it's marked as the backpacking type).
INSERT INTO "EventType" ("id", "name", "color", "backpacking", "sortOrder", "createdAt")
SELECT 'evtype_backpacking', 'Backpacking', '#8B5E34', true,
       COALESCE((SELECT MAX("sortOrder") + 1 FROM "EventType"), 0), CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "EventType" WHERE lower("name") = 'backpacking');
UPDATE "EventType" SET "backpacking" = true WHERE lower("name") = 'backpacking' AND "backpacking" = false;

CREATE TABLE IF NOT EXISTS "BackpackDay" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" TEXT NOT NULL,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackpackDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BackpackDay_userId_date_key" ON "BackpackDay"("userId", "date");
DO $$ BEGIN
  ALTER TABLE "BackpackDay" ADD CONSTRAINT "BackpackDay_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

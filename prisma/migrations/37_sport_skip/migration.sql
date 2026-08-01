-- A sport-workout calendar event no longer auto-logs a workout. Instead each
-- person is prompted ("did you do it?") on their dashboard card for that day.
-- "Yes" logs a SPORT WorkoutSession (linked by sourceEventId, as before); "No"
-- records a SportSkip so that one prompt stops nagging.
--
-- The row is keyed on (event, person, date): the date is the specific
-- occurrence, so a recurring practice is a fresh, independent prompt every day
-- and per person — one declining never affects another person or a future
-- occurrence. Re-runnable.

CREATE TABLE IF NOT EXISTS "SportSkip" (
    "id"        TEXT NOT NULL,
    "eventId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "date"      DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SportSkip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SportSkip_eventId_userId_date_key"
    ON "SportSkip"("eventId", "userId", "date");
CREATE INDEX IF NOT EXISTS "SportSkip_userId_date_idx"
    ON "SportSkip"("userId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SportSkip_eventId_fkey'
  ) THEN
    ALTER TABLE "SportSkip"
      ADD CONSTRAINT "SportSkip_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SportSkip_userId_fkey'
  ) THEN
    ALTER TABLE "SportSkip"
      ADD CONSTRAINT "SportSkip_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

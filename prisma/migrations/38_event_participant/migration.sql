-- Lets a calendar event carry several people. For a sport-workout event, each
-- participant gets their own "did you do it?" prompt (keyed per person per
-- occurrence, as before). An event with no participants falls back to its
-- owner, so existing events are unchanged. Re-runnable.

CREATE TABLE IF NOT EXISTS "EventParticipant" (
    "id"      TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId"  TEXT NOT NULL,
    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventParticipant_eventId_userId_key"
    ON "EventParticipant"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "EventParticipant_userId_idx"
    ON "EventParticipant"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EventParticipant_eventId_fkey'
  ) THEN
    ALTER TABLE "EventParticipant"
      ADD CONSTRAINT "EventParticipant_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EventParticipant_userId_fkey'
  ) THEN
    ALTER TABLE "EventParticipant"
      ADD CONSTRAINT "EventParticipant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Per-person reminder minutes on subscribed (feed) events.
CREATE TABLE IF NOT EXISTS "SubscribedReminder" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "minutes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  CONSTRAINT "SubscribedReminder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubscribedReminder_eventId_userId_key" ON "SubscribedReminder"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "SubscribedReminder_userId_idx" ON "SubscribedReminder"("userId");
DO $$ BEGIN
  ALTER TABLE "SubscribedReminder" ADD CONSTRAINT "SubscribedReminder_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

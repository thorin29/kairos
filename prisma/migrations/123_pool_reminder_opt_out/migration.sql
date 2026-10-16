-- People who stay in a shared chore's pool but never get its "your turn"
-- reminder (v0.584.0). No rows = everyone eligible can be reminded, so existing
-- chores behave exactly as before. Idempotent.
CREATE TABLE IF NOT EXISTS "PoolReminderOptOut" (
    "choreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "PoolReminderOptOut_pkey" PRIMARY KEY ("choreId", "userId")
);

CREATE INDEX IF NOT EXISTS "PoolReminderOptOut_userId_idx" ON "PoolReminderOptOut"("userId");

DO $$ BEGIN
  ALTER TABLE "PoolReminderOptOut" ADD CONSTRAINT "PoolReminderOptOut_choreId_fkey"
    FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PoolReminderOptOut" ADD CONSTRAINT "PoolReminderOptOut_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

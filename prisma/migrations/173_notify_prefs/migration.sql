-- Notifications (v0.772): each person's own choices, safety-alert memory,
-- and quiet hours (a held notification waits in the inbox).

CREATE TABLE IF NOT EXISTS "NotifyPrefs" (
  "userId" TEXT NOT NULL,
  "prefs" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotifyPrefs_pkey" PRIMARY KEY ("userId")
);
DO $$ BEGIN
  ALTER TABLE "NotifyPrefs" ADD CONSTRAINT "NotifyPrefs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SafetyAlertState" (
  "aboutUserId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SafetyAlertState_pkey" PRIMARY KEY ("aboutUserId", "recipientId", "kind")
);

ALTER TABLE "PushMessage" ADD COLUMN IF NOT EXISTS "deliverAfter" TIMESTAMP(3);

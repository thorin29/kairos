-- Personal reading plans: a plan can belong to one person (family plans leave
-- ownerId null). Idempotent.

ALTER TABLE "ReadingPlan" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

CREATE INDEX IF NOT EXISTS "ReadingPlan_ownerId_idx" ON "ReadingPlan"("ownerId");

DO $$ BEGIN
  ALTER TABLE "ReadingPlan" ADD CONSTRAINT "ReadingPlan_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

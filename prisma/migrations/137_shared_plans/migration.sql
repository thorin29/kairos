-- Shared household plans (v0.618.0): a person's weekly plan, named and sent
-- for a parent's approval (status PENDING, then APPROVED), that anyone can
-- then start from. `file` is the plan in the workouts-file shape (names, no
-- ids); `summary` is the plan in a line. Removing the person keeps an
-- approved plan. Idempotent.
CREATE TABLE IF NOT EXISTS "SharedPlan" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "ownerId"    TEXT,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "file"       JSONB NOT NULL,
  "summary"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "SharedPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SharedPlan_status_idx" ON "SharedPlan"("status");
DO $$ BEGIN
  ALTER TABLE "SharedPlan" ADD CONSTRAINT "SharedPlan_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

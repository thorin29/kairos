-- "Always open" chores become tap-to-complete: one tap on the dashboard is an
-- instant, scored completion credited to that person, repeatable through the
-- day. Each tap is its own row, so the per-person-per-day uniqueness that keeps
-- scheduled chores from doubling can't apply to them. A repeatKey column joins
-- the unique index (scheduled chores stay at 0; each tap gets a distinct value).
-- A cooldown lets an always-open chore disappear for a set number of minutes
-- after it's done, then come back. Additive and idempotent.

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "repeatKey" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Chore" ADD COLUMN IF NOT EXISTS "cooldownMinutes" INTEGER NOT NULL DEFAULT 0;

-- Swap the day-scoped unique index for one that also keys on repeatKey.
DROP INDEX IF EXISTS "Task_choreId_userId_dueDate_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Task_choreId_userId_dueDate_repeatKey_key"
  ON "Task" ("choreId", "userId", "dueDate", "repeatKey");

-- Clear any pending always-open instances left on the board by the old
-- scheduled model. Completed rows stay — they already count toward score.
DELETE FROM "Task" t
  USING "Chore" c
  WHERE t."choreId" = c."id"
    AND c."alwaysOpen" = true
    AND t."status" <> 'COMPLETE';

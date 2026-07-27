-- "Do anytime" chores: a chore assigned to a person that sits on their list
-- for a whole period (one or more weeks), can be done any day, and only goes
-- late at the end of the period. Task.lateAfter holds that period-end date;
-- Chore.isAnytime marks the type. Safe to re-run.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lateAfter" DATE;
ALTER TABLE "Chore" ADD COLUMN IF NOT EXISTS "isAnytime" BOOLEAN NOT NULL DEFAULT false;

-- Task alert time (minutes from midnight, household-local) on the due date;
-- copied onto each recurring occurrence from its template. NULL = no alert.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "notifyMinutes" INTEGER;
ALTER TABLE "RecurringTask" ADD COLUMN IF NOT EXISTS "notifyMinutes" INTEGER;

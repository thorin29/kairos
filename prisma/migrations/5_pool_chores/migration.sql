-- Shared chores: unassigned, claimed by whoever gets to them, and
-- rescheduled a fixed number of days after each completion.
ALTER TABLE "Chore" ADD COLUMN "isPool" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Chore" ADD COLUMN "intervalDays" INTEGER;
ALTER TABLE "Chore" ADD COLUMN "isPaused" BOOLEAN NOT NULL DEFAULT false;

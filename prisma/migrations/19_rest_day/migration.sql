-- A workout session can be flagged as a deliberate rest/skip day: the day is
-- handled (not nagging) but won't count toward scoring later. Safe to re-run.
ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "isRest" BOOLEAN NOT NULL DEFAULT false;

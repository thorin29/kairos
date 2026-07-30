-- A planned rest day: a PlannedWorkout marked isRest, so a weekday can be
-- scheduled as rest (no workout task generated for it). Additive, re-runnable.

ALTER TABLE "PlannedWorkout" ADD COLUMN IF NOT EXISTS "isRest" BOOLEAN NOT NULL DEFAULT false;

-- HIIT/CrossFit workouts: a session can carry a workout type (AMRAP / for time
-- / max sets) whose single result is stored as one set. Additive, re-runnable.

DO $$ BEGIN
    CREATE TYPE "WorkoutType" AS ENUM ('AMRAP', 'FOR_TIME', 'MAX_SETS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "workoutType" "WorkoutType";

-- A weekday's plan entry can be a named HIIT/CrossFit workout: PlannedWorkout
-- points at a HiitWorkout. Additive and re-runnable.

ALTER TABLE "PlannedWorkout" ADD COLUMN IF NOT EXISTS "hiitWorkoutId" TEXT;
CREATE INDEX IF NOT EXISTS "PlannedWorkout_hiitWorkoutId_idx" ON "PlannedWorkout"("hiitWorkoutId");

DO $$ BEGIN
    ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_hiitWorkoutId_fkey"
        FOREIGN KEY ("hiitWorkoutId") REFERENCES "HiitWorkout"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

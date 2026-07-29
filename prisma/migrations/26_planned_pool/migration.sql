-- Structured, pool-driven plans. Additive: existing name-only planned workouts
-- keep working (category/muscleGroup stay null; no exercises). Re-runnable.

ALTER TABLE "PlannedWorkout" ADD COLUMN IF NOT EXISTS "category" "WorkoutCategory";
ALTER TABLE "PlannedWorkout" ADD COLUMN IF NOT EXISTS "muscleGroup" "MuscleGroup";

CREATE TABLE IF NOT EXISTS "PlannedExercise" (
    "id" TEXT NOT NULL,
    "plannedWorkoutId" TEXT NOT NULL,
    "poolExerciseId" TEXT NOT NULL,
    "tracked" BOOLEAN NOT NULL DEFAULT true,
    "metric" "WorkoutMetric",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannedExercise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlannedExercise_plannedWorkoutId_poolExerciseId_key"
    ON "PlannedExercise"("plannedWorkoutId", "poolExerciseId");
CREATE INDEX IF NOT EXISTS "PlannedExercise_poolExerciseId_idx"
    ON "PlannedExercise"("poolExerciseId");

DO $$ BEGIN
    ALTER TABLE "PlannedExercise" ADD CONSTRAINT "PlannedExercise_plannedWorkoutId_fkey"
        FOREIGN KEY ("plannedWorkoutId") REFERENCES "PlannedWorkout"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "PlannedExercise" ADD CONSTRAINT "PlannedExercise_poolExerciseId_fkey"
        FOREIGN KEY ("poolExerciseId") REFERENCES "PoolExercise"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

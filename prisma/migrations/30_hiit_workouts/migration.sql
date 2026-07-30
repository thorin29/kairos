-- HIIT / CrossFit named workouts: a pool of workouts built from HIIT-pool
-- movements, each of a type. New types added to WorkoutType. Additive and
-- re-runnable. ADD VALUE IF NOT EXISTS is safe in-migration (values unused).

ALTER TYPE "WorkoutType" ADD VALUE IF NOT EXISTS 'FOR_REPS';
ALTER TYPE "WorkoutType" ADD VALUE IF NOT EXISTS 'STATIONS';
ALTER TYPE "WorkoutType" ADD VALUE IF NOT EXISTS 'TIMED_STATIONS';
ALTER TYPE "WorkoutType" ADD VALUE IF NOT EXISTS 'PYRAMID';

CREATE TABLE IF NOT EXISTS "HiitWorkout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkoutType" NOT NULL,
    "ownerId" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "capSec" INTEGER,
    "pyramidStart" INTEGER,
    "pyramidEnd" INTEGER,
    "pyramidStep" INTEGER DEFAULT 1,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HiitWorkout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HiitWorkout_ownerId_idx" ON "HiitWorkout"("ownerId");
CREATE INDEX IF NOT EXISTS "HiitWorkout_approved_idx" ON "HiitWorkout"("approved");

CREATE TABLE IF NOT EXISTS "HiitWorkoutMovement" (
    "id" TEXT NOT NULL,
    "hiitWorkoutId" TEXT NOT NULL,
    "poolExerciseId" TEXT NOT NULL,
    "reps" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HiitWorkoutMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HiitWorkoutMovement_hiitWorkoutId_idx" ON "HiitWorkoutMovement"("hiitWorkoutId");
CREATE INDEX IF NOT EXISTS "HiitWorkoutMovement_poolExerciseId_idx" ON "HiitWorkoutMovement"("poolExerciseId");

DO $$ BEGIN
    ALTER TABLE "HiitWorkout" ADD CONSTRAINT "HiitWorkout_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "HiitWorkoutMovement" ADD CONSTRAINT "HiitWorkoutMovement_hiitWorkoutId_fkey"
        FOREIGN KEY ("hiitWorkoutId") REFERENCES "HiitWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "HiitWorkoutMovement" ADD CONSTRAINT "HiitWorkoutMovement_poolExerciseId_fkey"
        FOREIGN KEY ("poolExerciseId") REFERENCES "PoolExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

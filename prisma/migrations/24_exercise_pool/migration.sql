-- Household-level exercise pool: a shared, admin-managed library of movements,
-- categorised, with a built-in muscle-group sub-category for weights. People
-- will pick from this pool when planning and logging, so the same movement is
-- one shared thing everyone can be compared on. Additive and safe to re-run.

-- Idempotent enum create: does nothing if the type already exists, so it never
-- drops a dependent column on a re-run.
DO $$ BEGIN
  CREATE TYPE "MuscleGroup" AS ENUM
    ('CHEST', 'BACK', 'SHOULDERS', 'LEGS', 'ARMS', 'CORE', 'FULL_BODY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "PoolExercise" (
    "id"          TEXT NOT NULL,
    "category"    "WorkoutCategory" NOT NULL,
    "name"        TEXT NOT NULL,
    "muscleGroup" "MuscleGroup",
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PoolExercise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PoolExercise_category_name_key"
    ON "PoolExercise"("category", "name");
CREATE INDEX IF NOT EXISTS "PoolExercise_category_muscleGroup_isActive_idx"
    ON "PoolExercise"("category", "muscleGroup", "isActive");

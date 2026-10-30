-- Workout programs (v0.611.0). Idempotent.

-- How a planned movement's sets are laid out ("wave", "range:3x8-12",
-- "same:3x5"; src/lib/workouts/programs.ts) and which program slot wrote it.
ALTER TABLE "PlannedExercise" ADD COLUMN IF NOT EXISTS "scheme" TEXT;
ALTER TABLE "PlannedExercise" ADD COLUMN IF NOT EXISTS "programRole" TEXT;

-- A light or test day, recorded when a program day is logged, so charts can
-- draw it hollow.
ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "intent" TEXT;

-- A person's program: which one, when the current block started, their
-- training maxes, and the plan it replaced (to go back to when it ends).
CREATE TABLE IF NOT EXISTS "PersonProgram" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programKey" TEXT NOT NULL,
    "startedOn" DATE NOT NULL,
    "blockStartedOn" DATE NOT NULL,
    "days" TEXT NOT NULL,
    "trainingMaxes" JSONB NOT NULL DEFAULT '{}',
    "previousPlan" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "endedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonProgram_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PersonProgram_userId_status_idx" ON "PersonProgram"("userId", "status");

DO $$ BEGIN
  ALTER TABLE "PersonProgram" ADD CONSTRAINT "PersonProgram_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Workout rotations: an ordered cycle of days that repeats independent of the
-- calendar, with fixed rest weekdays that pause the cycle. One rotation per
-- person (its presence puts them on a rotation instead of a weekly plan).
-- Idempotent.

CREATE TABLE IF NOT EXISTS "WorkoutRotation" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "anchorDate" DATE NOT NULL,
  "restMask"   INTEGER NOT NULL DEFAULT 0,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkoutRotation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutRotation_userId_key"
  ON "WorkoutRotation"("userId");

CREATE TABLE IF NOT EXISTS "RotationSlot" (
  "id"          TEXT NOT NULL,
  "rotationId"  TEXT NOT NULL,
  "position"    INTEGER NOT NULL,
  "name"        TEXT NOT NULL,
  "category"    "WorkoutCategory",
  "muscleGroup" "MuscleGroup",
  "isRest"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RotationSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RotationSlot_rotationId_position_key"
  ON "RotationSlot"("rotationId", "position");

DO $$ BEGIN
  ALTER TABLE "WorkoutRotation" ADD CONSTRAINT "WorkoutRotation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RotationSlot" ADD CONSTRAINT "RotationSlot_rotationId_fkey"
    FOREIGN KEY ("rotationId") REFERENCES "WorkoutRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

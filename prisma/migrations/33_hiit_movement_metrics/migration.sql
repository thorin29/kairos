-- Tabata workout type, and per-movement distance/weight so a HIIT workout can
-- carry a run distance or a weighted movement. Additive and re-runnable.

ALTER TYPE "WorkoutType" ADD VALUE IF NOT EXISTS 'TABATA';

ALTER TABLE "HiitWorkoutMovement" ADD COLUMN IF NOT EXISTS "distance" DOUBLE PRECISION;
ALTER TABLE "HiitWorkoutMovement" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION;

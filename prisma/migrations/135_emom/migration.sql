-- EMOM as a workout type (v0.616.0): a movement at the start of every minute
-- for a set number of minutes (HiitWorkout.capSec holds the length). Idempotent.
ALTER TYPE "WorkoutType" ADD VALUE IF NOT EXISTS 'EMOM';

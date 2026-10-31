-- Cardio and Warm-up as plan categories (v0.615.0). A Cardio plan is done by
-- any row, run or ruck that day (or "other cardio" logged under CARDIO); a
-- Warm-up plan holds nothing and is done with a tap. Idempotent.
ALTER TYPE "WorkoutCategory" ADD VALUE IF NOT EXISTS 'CARDIO';
ALTER TYPE "WorkoutCategory" ADD VALUE IF NOT EXISTS 'WARMUP';

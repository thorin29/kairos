-- A day can hold more than one workout. Each WorkoutSession becomes one named
-- workout: an optional name and category label it in the day's list. Also adds
-- the RUCKING category. Safe to re-run.

-- New category. ADD VALUE IF NOT EXISTS is idempotent; it only adds the label,
-- so it is safe within the migration transaction (the value is not used here).
ALTER TYPE "WorkoutCategory" ADD VALUE IF NOT EXISTS 'RUCKING';

ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "category" "WorkoutCategory";

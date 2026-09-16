-- Optional per-plan start date: scheduling begins on this day instead of today.
ALTER TABLE "ClassPlan" ADD COLUMN IF NOT EXISTS "startDate" DATE;

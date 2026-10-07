-- When an overdue workout is logged later than the day it was due, the session
-- keeps `date` as the DUE day (adherence is keyed on it: loadOverdueWorkoutDays
-- asks whether that day's planned exercises have values) and records the day it
-- was actually done here.
--
-- Null means "same as date" — true of every existing row, every same-day log,
-- and every deliberately back-dated one, so there is nothing to backfill.
ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "completedOn" DATE;

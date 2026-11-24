-- Workouts (v0.780): elevation gain and loss for walks, runs, rucks and hikes
-- tracked in the app.

ALTER TABLE "WorkoutTrack" ADD COLUMN IF NOT EXISTS "gainM" DOUBLE PRECISION;
ALTER TABLE "WorkoutTrack" ADD COLUMN IF NOT EXISTS "lossM" DOUBLE PRECISION;

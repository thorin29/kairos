-- Named conditioning workouts (v0.617.0): the library entry a workout came
-- from, its how-to, its kind (DAILY / BENCHMARK / HERO), about how many
-- minutes it takes and its Scaled version (per movement, JSON). A logged
-- conditioning result records which version was done (RX / SCALED).
-- All optional; existing workouts and results are untouched. Idempotent.
ALTER TABLE "HiitWorkout" ADD COLUMN IF NOT EXISTS "libraryKey" TEXT;
ALTER TABLE "HiitWorkout" ADD COLUMN IF NOT EXISTS "about" TEXT;
ALTER TABLE "HiitWorkout" ADD COLUMN IF NOT EXISTS "kind" TEXT;
ALTER TABLE "HiitWorkout" ADD COLUMN IF NOT EXISTS "minutes" INTEGER;
ALTER TABLE "HiitWorkout" ADD COLUMN IF NOT EXISTS "scaled" JSONB;
CREATE INDEX IF NOT EXISTS "HiitWorkout_libraryKey_idx" ON "HiitWorkout"("libraryKey");
ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "version" TEXT;

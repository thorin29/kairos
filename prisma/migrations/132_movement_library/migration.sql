-- The movement library (v0.613.0): what a movement needs, its type, where it
-- sits in a bodyweight ladder, which library entry it came from, and a short
-- how-to. All optional; existing movements keep working untouched. Idempotent.
ALTER TABLE "PoolExercise" ADD COLUMN IF NOT EXISTS "equipment" TEXT;
ALTER TABLE "PoolExercise" ADD COLUMN IF NOT EXISTS "pattern" TEXT;
ALTER TABLE "PoolExercise" ADD COLUMN IF NOT EXISTS "ladderKey" TEXT;
ALTER TABLE "PoolExercise" ADD COLUMN IF NOT EXISTS "ladderStep" INTEGER;
ALTER TABLE "PoolExercise" ADD COLUMN IF NOT EXISTS "libraryKey" TEXT;
ALTER TABLE "PoolExercise" ADD COLUMN IF NOT EXISTS "about" TEXT;
CREATE INDEX IF NOT EXISTS "PoolExercise_libraryKey_idx" ON "PoolExercise"("libraryKey");

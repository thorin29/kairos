-- Warm-up routines (v0.622.0): a person's own warm-up, a list of steps (reps
-- or timed holds) kept as JSON. A Warm-up plan entry names the routine it
-- shows in `warmup`: a library routine ("lib:<key>", defined in code) or one
-- of these by id; null is a plain check. Idempotent.
CREATE TABLE IF NOT EXISTS "WarmupRoutine" (
  "id"        TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "steps"     JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WarmupRoutine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WarmupRoutine_ownerId_idx" ON "WarmupRoutine"("ownerId");
DO $$ BEGIN
  ALTER TABLE "WarmupRoutine" ADD CONSTRAINT "WarmupRoutine_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "PlannedWorkout" ADD COLUMN IF NOT EXISTS "warmup" TEXT;

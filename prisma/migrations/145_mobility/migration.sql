-- Mobility (v0.659): a plan category done with a tap, like Warm-up, and
-- routines that say whether they're a warm-up or mobility.
ALTER TYPE "WorkoutCategory" ADD VALUE IF NOT EXISTS 'MOBILITY';
ALTER TABLE "WarmupRoutine" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'warmup';
CREATE INDEX "WarmupRoutine_ownerId_kind_idx" ON "WarmupRoutine"("ownerId", "kind");

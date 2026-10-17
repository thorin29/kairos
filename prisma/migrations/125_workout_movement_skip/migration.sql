-- A planned movement skipped for one day (v0.586.0). Skipping counts as done
-- for that movement, so a day with several planned movements is complete only
-- once each one is logged or skipped. No rows = nothing skipped. Idempotent.
CREATE TABLE IF NOT EXISTS "WorkoutMovementSkip" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutMovementSkip_pkey" PRIMARY KEY ("userId", "date", "slot")
);

DO $$ BEGIN
  ALTER TABLE "WorkoutMovementSkip" ADD CONSTRAINT "WorkoutMovementSkip_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

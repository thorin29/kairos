-- How a movement felt, and anything that hurt, for one person on one day
-- (v0.610.0). `slot` is the planned movement (pool exercise id). Effort is
-- EASY / SOLID / HARD / TOO_HARD; hurt is an area key (HURT_AREAS in
-- src/lib/workouts/catalog.ts). Idempotent.
CREATE TABLE IF NOT EXISTS "WorkoutFeedback" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" TEXT NOT NULL,
    "effort" TEXT,
    "hurt" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutFeedback_pkey" PRIMARY KEY ("userId", "date", "slot")
);

DO $$ BEGIN
  ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

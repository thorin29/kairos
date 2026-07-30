-- Sharing workflow: a person can request that their own workout be shared;
-- an admin approves it into the shared pool. Additive and re-runnable.

ALTER TABLE "HiitWorkout" ADD COLUMN IF NOT EXISTS "shareRequested" BOOLEAN NOT NULL DEFAULT false;

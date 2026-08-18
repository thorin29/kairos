-- An "always open" shared chore (e.g. take out the garbage): perpetually up for
-- grabs. Once someone does it, a fresh open instance appears immediately, with
-- no schedule to wait on. Additive and idempotent.
ALTER TABLE "Chore" ADD COLUMN IF NOT EXISTS "alwaysOpen" BOOLEAN NOT NULL DEFAULT false;

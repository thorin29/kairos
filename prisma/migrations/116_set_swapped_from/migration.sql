-- A set logged in place of a planned movement remembers which slot it filled,
-- so a one-day swap round-trips instead of leaving the planned row blank.
ALTER TABLE "SessionSet" ADD COLUMN IF NOT EXISTS "swappedFromId" TEXT;

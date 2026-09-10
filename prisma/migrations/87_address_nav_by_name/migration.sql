-- Per-address "open in maps by name" flag (on for businesses, off for homes).
ALTER TABLE "SavedAddress" ADD COLUMN IF NOT EXISTS "navByName" BOOLEAN NOT NULL DEFAULT true;

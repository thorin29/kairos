-- Whether a planned break is confirmed (or covered by a real vacation).
ALTER TABLE "SchoolBreak" ADD COLUMN IF NOT EXISTS "confirmed" BOOLEAN NOT NULL DEFAULT false;

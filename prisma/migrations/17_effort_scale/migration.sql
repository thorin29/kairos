-- Move chore effort to a 1-5 scale (was 1-3) and let a value be locked so it
-- isn't changed by accident. Existing 1/2/3 values stay valid on the new
-- scale; only the default for new chores changes. Guarded to be re-runnable.
ALTER TABLE "Chore" ALTER COLUMN "effort" SET DEFAULT 3;
ALTER TABLE "Chore" ADD COLUMN IF NOT EXISTS "effortLocked" BOOLEAN NOT NULL DEFAULT false;

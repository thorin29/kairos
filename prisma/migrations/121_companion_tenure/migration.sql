-- A companion can be put back in the saddle, so growth has to survive a spell
-- on the shelf.
--
-- Growth is measured from a date. With one tenure that date was `acquiredAt`
-- and nothing else was needed. Bringing an old companion back makes that wrong
-- in both directions: measuring from `acquiredAt` hands it every clean day
-- since it was first hatched (a shelved hatchling would return a full adult),
-- and measuring from the day it returns throws away everything it had earned.
--
-- So: growth earned in past tenures is banked, and the current tenure is
-- measured from when it started. Total growth is the sum.
--
-- Defaults are right for existing rows. Banked 0 and a null tenure start read
-- as "one tenure, from acquiredAt", which is exactly what they are — the code
-- falls back to acquiredAt when the column is null, so nothing is backfilled.
ALTER TABLE "Companion" ADD COLUMN IF NOT EXISTS "growthBanked" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Companion" ADD COLUMN IF NOT EXISTS "tenureStartedAt" TIMESTAMP(3);

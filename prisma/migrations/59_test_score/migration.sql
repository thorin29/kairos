-- A score on a test, so completing one can reflect how well it went, not just
-- that it's done. Feeds the Scholar stat: a higher score pushes School above
-- the family baseline, so doing well (not just finishing) can make School your
-- focus. Only tests use it; other school work stays pass/done.
--
-- Additive and idempotent: both nullable, scoreMax defaults to 100 so a plain
-- percentage works out of the box.

ALTER TABLE "SchoolWork" ADD COLUMN IF NOT EXISTS "score" INTEGER;
ALTER TABLE "SchoolWork" ADD COLUMN IF NOT EXISTS "scoreMax" INTEGER;

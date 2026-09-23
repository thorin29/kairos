-- The page a goal's segment starts from (previous goal's target, or the reader's
-- position when the first goal was set), so progress is measured across the
-- segment [startPage, target] rather than from page 1.
ALTER TABLE "ReadingGoal" ADD COLUMN "startPage" INTEGER NOT NULL DEFAULT 0;

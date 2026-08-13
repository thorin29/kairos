-- Optional effort weight on a one-off task. Chores already carry a 1-5 effort;
-- workouts, Bible reading and school are deliberately flat (the point is doing
-- them, on time). This lets an admin put a heavier weight on a hand-added task
-- when it genuinely takes more — everything unweighted scores as 1.
--
-- Nullable and additive: existing rows read back NULL and the scoring engine
-- treats NULL as the default, so nothing needs backfilling.

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "weight" INTEGER;

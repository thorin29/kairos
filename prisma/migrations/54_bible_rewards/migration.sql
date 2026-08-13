-- Money: per-person Bible-reading reward. A checkbox (earns a reward for
-- finishing a month's reading) and the amount in whole cents. The household
-- group bonus and grace period are AppSetting rows, so they need no column.
--
-- Additive and re-runnable: two columns with safe defaults, nothing rewritten.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bibleRewardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bibleRewardCents" INTEGER NOT NULL DEFAULT 0;

-- Companions brought back from the gallery could restart as hatchlings
-- (fixed in v0.585.0).
--
-- Migration 121 gave every row growthBanked = 0. Growth for a returning
-- companion is growthBanked + growth since it came back, so one shelved before
-- 0.576 — shown in the gallery at its minted stage, often adult — returned
-- with nothing banked. The code now floors banked growth at the minted stage
-- (bankedGrowthFloor), which repairs rows that HAVE a mintedStage at read time.
--
-- This stamps the stage on rows that have none, matching what the gallery has
-- always displayed for them (mintedStage ?? 2 = adult):
--   * shelved rows with no minted stage, so bringing them back works;
--   * active rows that were brought back from such a shelf — recognisable
--     because their current tenure began well after they hatched. A companion
--     hatched since 0.576 starts its tenure the moment it hatches; one active
--     since before 0.576 has no tenure start at all. Neither is touched.
-- Only NULLs are written, so it is idempotent.
UPDATE "Companion"
SET "mintedStage" = 2
WHERE "mintedStage" IS NULL
  AND (
    "isActive" = false
    OR ("tenureStartedAt" IS NOT NULL
        AND "tenureStartedAt" > "acquiredAt" + INTERVAL '1 day')
  );

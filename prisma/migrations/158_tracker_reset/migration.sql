-- v0.726: "Start over" on the Bible tracker. Bars count from the latest one;
-- times read and milestones keep counting everything.
CREATE TABLE IF NOT EXISTS "TrackerReset" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrackerReset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TrackerReset_scope_idx" ON "TrackerReset"("scope");

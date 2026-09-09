-- Recurring tasks: a template that materializes Task rows on a schedule
-- (daily/weekly/monthly, ending never / after N / on a date). Non-scoring is
-- not special-cased; they behave like ordinary tasks once generated.
CREATE TABLE IF NOT EXISTS "RecurringTask" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "category" "Category" NOT NULL DEFAULT 'OTHER',
  "weight" INTEGER,
  "freq" TEXT NOT NULL DEFAULT 'WEEKLY',
  "interval" INTEGER NOT NULL DEFAULT 1,
  "byday" TEXT,
  "startDate" DATE NOT NULL,
  "endMode" TEXT NOT NULL DEFAULT 'NEVER',
  "maxCount" INTEGER,
  "untilDate" DATE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringTask_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "RecurringTask_active_idx" ON "RecurringTask"("active");

-- v0.724: the Bible tracker replaces reading eras. Every chapter read is a row
-- in "BibleRead"; manual checklist marks belong to a manual run; finished plans
-- are kept in "ReadingPlanDone". Plans record how they end; a day can carry an
-- extra reading beside its plan reading.
DROP TABLE IF EXISTS "ReadingEra";

ALTER TABLE "ReadingPlan" ADD COLUMN IF NOT EXISTS "endKind" TEXT NOT NULL DEFAULT 'DATE';
ALTER TABLE "ReadingDay" ADD COLUMN IF NOT EXISTS "extra" TEXT;

CREATE TABLE IF NOT EXISTS "BibleRead" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "ownerId" TEXT,
  "bookName" TEXT NOT NULL,
  "chapter" INTEGER NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "sourceKey" TEXT,
  "runId" TEXT,
  "timed" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "BibleRead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BibleRead_scope_source_sourceKey_bookName_chapter_key"
  ON "BibleRead"("scope", "source", "sourceKey", "bookName", "chapter");
CREATE INDEX IF NOT EXISTS "BibleRead_scope_idx" ON "BibleRead"("scope");
CREATE INDEX IF NOT EXISTS "BibleRead_runId_idx" ON "BibleRead"("runId");

CREATE TABLE IF NOT EXISTS "ManualReadingRun" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "ownerId" TEXT,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "chapters" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualReadingRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ManualReadingRun_scope_idx" ON "ManualReadingRun"("scope");

CREATE TABLE IF NOT EXISTS "ReadingPlanDone" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "ownerId" TEXT,
  "planId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "startOn" DATE,
  "endOn" DATE,
  "days" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReadingPlanDone_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReadingPlanDone_planId_key" ON "ReadingPlanDone"("planId");
CREATE INDEX IF NOT EXISTS "ReadingPlanDone_scope_idx" ON "ReadingPlanDone"("scope");

DO $$ BEGIN
  ALTER TABLE "BibleRead" ADD CONSTRAINT "BibleRead_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ManualReadingRun" ADD CONSTRAINT "ManualReadingRun_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ReadingPlanDone" ADD CONSTRAINT "ReadingPlanDone_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- What each person had already logged counts once, untimed, in an open manual
-- run (so it still shows on their checklist). The family's hand marks are
-- carried over by the server on first load, skipping chapters the published
-- plan already took the household through.
INSERT INTO "ManualReadingRun" ("id", "scope", "ownerId", "startedAt")
SELECT 'seed_' || u."userId", u."userId", u."userId", NULL
FROM (SELECT DISTINCT "userId" FROM "UserChapterRead") u
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "BibleRead" ("id", "scope", "ownerId", "bookName", "chapter", "readAt", "source", "runId", "timed")
SELECT 'seed_' || md5(r."userId" || '|' || r."bookName" || '|' || r."chapter"),
       r."userId", r."userId", r."bookName", r."chapter", r."completedAt", 'manual', 'seed_' || r."userId", false
FROM "UserChapterRead" r
ON CONFLICT ("id") DO NOTHING;

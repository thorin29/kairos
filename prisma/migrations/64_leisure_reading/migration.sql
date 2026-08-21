-- Leisure reading: per-person books with daily reading logs. Never overdue;
-- feeds the Scholar stat slightly, derived at read time. Idempotent.

DO $$ BEGIN
  CREATE TYPE "ReadingUnit" AS ENUM ('PAGES', 'CHAPTERS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Book" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "unit"       "ReadingUnit" NOT NULL DEFAULT 'PAGES',
  "length"     INTEGER NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Book_userId_idx" ON "Book"("userId");

CREATE TABLE IF NOT EXISTS "BookLog" (
  "id"        TEXT NOT NULL,
  "bookId"    TEXT NOT NULL,
  "day"       DATE NOT NULL,
  "amount"    INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookLog_bookId_day_idx" ON "BookLog"("bookId", "day");

DO $$ BEGIN
  ALTER TABLE "Book" ADD CONSTRAINT "Book_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "BookLog" ADD CONSTRAINT "BookLog_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

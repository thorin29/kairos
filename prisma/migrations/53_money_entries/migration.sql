-- Money: a personal ledger per person who keeps one. One row per movement.
-- A person shows on the Money page only if they have at least one row, and a
-- balance is summed at read time from every row (pending included), so nothing
-- here needs backfilling and approval never changes a number.
--
-- Additive and re-runnable: new types, one new table, no changes to anything
-- that exists.

DO $$ BEGIN
    CREATE TYPE "MoneyDirection" AS ENUM ('DEPOSIT', 'PAYMENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "MoneyCategory" AS ENUM ('BIRTHDAY', 'GIFT', 'HOLIDAY', 'EARNINGS', 'BIBLE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "MoneyStatus" AS ENUM ('PENDING', 'APPROVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "MoneyKind" AS ENUM ('MANUAL', 'STARTING', 'BIBLE_REWARD', 'BIBLE_BONUS', 'IMPORT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "MoneyEntry" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "date"         DATE NOT NULL,
    "direction"    "MoneyDirection" NOT NULL,
    "category"     "MoneyCategory",
    "detail"       TEXT,
    "amountCents"  INTEGER NOT NULL,
    "status"       "MoneyStatus" NOT NULL DEFAULT 'PENDING',
    "kind"         "MoneyKind" NOT NULL DEFAULT 'MANUAL',
    "periodKey"    TEXT,
    "createdById"  TEXT,
    "approvedById" TEXT,
    "approvedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MoneyEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MoneyEntry_userId_date_idx" ON "MoneyEntry"("userId", "date");
CREATE INDEX IF NOT EXISTS "MoneyEntry_status_idx" ON "MoneyEntry"("status");
-- At most one reward and one bonus per person per month. NULL periodKey rows
-- (all the manual/starting/import ones) are exempt: Postgres treats NULLs as
-- distinct in a unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "MoneyEntry_userId_kind_periodKey_key"
    ON "MoneyEntry"("userId", "kind", "periodKey");

DO $$ BEGIN
    ALTER TABLE "MoneyEntry" ADD CONSTRAINT "MoneyEntry_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "MoneyEntry" ADD CONSTRAINT "MoneyEntry_approvedById_fkey"
        FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

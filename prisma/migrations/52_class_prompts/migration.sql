-- Post-class prompt: an opt-in per class (on by default) to ask each member,
-- after a meeting ends, whether they attended and whether work was assigned;
-- and a per-member, per-day record of that answer so the prompt stops asking.
-- Additive and re-runnable.

ALTER TABLE "SchoolClass"
  ADD COLUMN IF NOT EXISTS "promptHomework" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "ClassCheckin" (
    "id"        TEXT NOT NULL,
    "classId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "date"      DATE NOT NULL,
    "attended"  BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassCheckin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClassCheckin_classId_userId_date_key"
    ON "ClassCheckin"("classId", "userId", "date");
CREATE INDEX IF NOT EXISTS "ClassCheckin_userId_date_idx"
    ON "ClassCheckin"("userId", "date");

ALTER TABLE "ClassCheckin" DROP CONSTRAINT IF EXISTS "ClassCheckin_classId_fkey";
ALTER TABLE "ClassCheckin" ADD CONSTRAINT "ClassCheckin_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassCheckin" DROP CONSTRAINT IF EXISTS "ClassCheckin_userId_fkey";
ALTER TABLE "ClassCheckin" ADD CONSTRAINT "ClassCheckin_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

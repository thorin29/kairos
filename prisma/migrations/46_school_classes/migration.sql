-- School Phase 2a: admin-managed terms and classes. A class optionally owns a
-- recurring CLASS calendar event (its meeting schedule). Additive, re-runnable.
CREATE TABLE IF NOT EXISTS "Term" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate"   DATE NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SchoolClass" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "termId"    TEXT,
    "color"     TEXT,
    "eventId"   TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolClass_eventId_key" ON "SchoolClass"("eventId");
CREATE INDEX IF NOT EXISTS "SchoolClass_userId_idx" ON "SchoolClass"("userId");
CREATE INDEX IF NOT EXISTS "SchoolClass_termId_idx" ON "SchoolClass"("termId");

ALTER TABLE "SchoolClass" DROP CONSTRAINT IF EXISTS "SchoolClass_userId_fkey";
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolClass" DROP CONSTRAINT IF EXISTS "SchoolClass_termId_fkey";
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_termId_fkey"
    FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchoolClass" DROP CONSTRAINT IF EXISTS "SchoolClass_eventId_fkey";
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

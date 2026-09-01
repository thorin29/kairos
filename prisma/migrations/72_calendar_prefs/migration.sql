-- Per-user personal-calendar preferences (DECISIONS.md "Personal calendar…").
-- Only the signed-in personal view / mobile app read this; the shared wall
-- tablet ignores it. One table for the whole epic: Phase A uses the structure
-- columns, Phase B the colour columns. Idempotent.

CREATE TABLE IF NOT EXISTS "UserCalendarPref" (
  "userId"            TEXT NOT NULL,
  "view"              TEXT NOT NULL DEFAULT 'week',
  "showFamily"        BOOLEAN NOT NULL DEFAULT false,
  "showSchoolWork"    BOOLEAN NOT NULL DEFAULT true,
  "shownPeople"       JSONB,
  "shownSubs"         JSONB,
  "personalizeColors" BOOLEAN NOT NULL DEFAULT false,
  "othersMode"        TEXT NOT NULL DEFAULT 'own',
  "othersColor"       TEXT,
  "nowColor"          TEXT,
  "holidayColor"      TEXT,
  "kindColors"        JSONB,
  "eventTypeColors"   JSONB,
  "subColors"         JSONB,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCalendarPref_pkey" PRIMARY KEY ("userId")
);

DO $$ BEGIN
  ALTER TABLE "UserCalendarPref" ADD CONSTRAINT "UserCalendarPref_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

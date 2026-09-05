-- Per-user override of the family calendar colour, personal view only.
ALTER TABLE "UserCalendarPref" ADD COLUMN IF NOT EXISTS "familyColor" TEXT;

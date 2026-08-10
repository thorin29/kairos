-- School: window vs date-specific work. Window items (homework, projects) show
-- from a start date until done; date-specific items (tests) only on the due
-- date. Additive.
ALTER TABLE "SchoolWork" ADD COLUMN IF NOT EXISTS "dateSpecific" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SchoolWork" ADD COLUMN IF NOT EXISTS "startDate" DATE;

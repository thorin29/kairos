-- School work can carry an optional time of day it's due, so a due item can
-- land as a timed block on the calendar rather than an all-day chip. Additive
-- and re-runnable.

ALTER TABLE "SchoolWork" ADD COLUMN IF NOT EXISTS "dueMinutes" INTEGER;

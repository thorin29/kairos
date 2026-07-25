-- Two things the reading plan was missing:
--
-- 1. Extra readings — a Christmas or Easter passage dropped onto a date that
--    shouldn't count towards how much of the Bible has been covered. Marked
--    with isExtra so the statistics can leave them out.
--
-- 2. A record of what a household had already read before this app existed,
--    so the coverage percentage reflects where they actually are rather than
--    only what this installation has scheduled. One row per completed book.

ALTER TABLE "ReadingDay" ADD COLUMN "isExtra" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BookCompletion" (
    "bookName"    TEXT NOT NULL,
    "note"        TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookCompletion_pkey" PRIMARY KEY ("bookName")
);

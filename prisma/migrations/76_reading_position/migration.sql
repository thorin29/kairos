-- Reading now tracks a current position (the page/chapter you're up to) on the
-- book itself; how far you've read and the Scholar XP derive from it at read
-- time, so paging back and forth can't bank extra credit. Backfill the position
-- from any existing per-day logs (their sum was the total read). The old
-- `bookmarked` column is left in place (unused) rather than dropped — no
-- destructive changes.
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;

UPDATE "Book"
SET "position" = COALESCE(
  (SELECT SUM("amount") FROM "BookLog" WHERE "BookLog"."bookId" = "Book"."id"),
  0
)
WHERE "position" = 0;

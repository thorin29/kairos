-- Leisure books gain an optional author, page/chapter size metadata (at least
-- one; both allowed), and shelf/bookmark flags for the bookshelf. Progress still
-- runs on unit/length; pages/chapters are backfilled from the old single unit so
-- existing books keep their size.
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "author" TEXT;
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "pages" INTEGER;
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "chapters" INTEGER;
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "shelved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "bookmarked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Book" SET "pages" = "length" WHERE "unit" = 'PAGES' AND "pages" IS NULL;
UPDATE "Book" SET "chapters" = "length" WHERE "unit" = 'CHAPTERS' AND "chapters" IS NULL;

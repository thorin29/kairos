-- Personal Bible reading: each person's own record of chapters read, in any
-- order. Separate from the shared household ChapterCompletion. Idempotent.

CREATE TABLE IF NOT EXISTS "UserChapterRead" (
  "userId"      TEXT NOT NULL,
  "bookName"    TEXT NOT NULL,
  "chapter"     INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserChapterRead_pkey" PRIMARY KEY ("userId", "bookName", "chapter")
);

CREATE INDEX IF NOT EXISTS "UserChapterRead_userId_idx" ON "UserChapterRead"("userId");

DO $$ BEGIN
  ALTER TABLE "UserChapterRead" ADD CONSTRAINT "UserChapterRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

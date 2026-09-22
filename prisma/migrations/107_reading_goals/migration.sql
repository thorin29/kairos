-- Optional, sequential reading goals for a book: reach "target" (a page/chapter
-- in the book's unit) by "dueDate". Partial goals are fine — they need not cover
-- the whole book. A goal is met once the book's position reaches its target;
-- goals are a planning aid and do not affect reading's Scholar XP.
CREATE TABLE "ReadingGoal" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReadingGoal_bookId_idx" ON "ReadingGoal"("bookId");

ALTER TABLE "ReadingGoal" ADD CONSTRAINT "ReadingGoal_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

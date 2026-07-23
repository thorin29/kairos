-- Replace the flat ChoreTemplate with a Chore identity plus assignments,
-- and link generated tasks back to the chore they came from.

DROP TABLE IF EXISTS "ChoreTemplate";

CREATE TABLE "Chore" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "staleAfterDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Chore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Chore_title_key" ON "Chore"("title");

CREATE TABLE "ChoreAssignment" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChoreAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChoreAssignment_choreId_userId_dayOfWeek_key"
    ON "ChoreAssignment"("choreId", "userId", "dayOfWeek");
CREATE INDEX "ChoreAssignment_dayOfWeek_isActive_idx"
    ON "ChoreAssignment"("dayOfWeek", "isActive");

ALTER TABLE "Task" ADD COLUMN "choreId" TEXT;

CREATE UNIQUE INDEX "Task_choreId_userId_dueDate_key"
    ON "Task"("choreId", "userId", "dueDate");
CREATE INDEX "Task_choreId_dueDate_idx" ON "Task"("choreId", "dueDate");

ALTER TABLE "ChoreAssignment" ADD CONSTRAINT "ChoreAssignment_choreId_fkey"
    FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChoreAssignment" ADD CONSTRAINT "ChoreAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_choreId_fkey"
    FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

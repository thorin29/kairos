-- School Phase 1: assignments and tests are SCHOOL tasks, with a detail table
-- attached to Task carrying the work type and a free-text subject. Additive
-- and re-runnable.
DO $$ BEGIN
  CREATE TYPE "SchoolWorkType" AS ENUM ('HOMEWORK', 'ASSIGNMENT', 'TEST', 'PROJECT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "SchoolWork" (
    "id"        TEXT NOT NULL,
    "taskId"    TEXT NOT NULL,
    "type"      "SchoolWorkType" NOT NULL DEFAULT 'ASSIGNMENT',
    "subject"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolWork_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolWork_taskId_key" ON "SchoolWork"("taskId");
ALTER TABLE "SchoolWork" DROP CONSTRAINT IF EXISTS "SchoolWork_taskId_fkey";
ALTER TABLE "SchoolWork" ADD CONSTRAINT "SchoolWork_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

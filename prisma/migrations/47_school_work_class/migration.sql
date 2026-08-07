-- School Phase 2b: assignments and tests can hang under a class. Additive.
ALTER TABLE "SchoolWork" ADD COLUMN IF NOT EXISTS "classId" TEXT;
CREATE INDEX IF NOT EXISTS "SchoolWork_classId_idx" ON "SchoolWork"("classId");
ALTER TABLE "SchoolWork" DROP CONSTRAINT IF EXISTS "SchoolWork_classId_fkey";
ALTER TABLE "SchoolWork" ADD CONSTRAINT "SchoolWork_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

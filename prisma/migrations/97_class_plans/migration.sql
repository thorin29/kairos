-- Curriculum class plans: an ordered list of units spread into SchoolWork.
CREATE TYPE "ClassPlanStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "ClassPlan" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "bothTerms" BOOLEAN NOT NULL DEFAULT false,
    "perDay" INTEGER NOT NULL DEFAULT 1,
    "weekdays" TEXT NOT NULL DEFAULT '12345',
    "startIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "ClassPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassPlan_classId_key" ON "ClassPlan"("classId");

CREATE TABLE "ClassPlanUnit" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" "SchoolWorkType" NOT NULL DEFAULT 'ASSIGNMENT',
    "load" INTEGER NOT NULL DEFAULT 1,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "scheduledDate" DATE,
    "workId" TEXT,
    CONSTRAINT "ClassPlanUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassPlanUnit_planId_seq_key" ON "ClassPlanUnit"("planId", "seq");
CREATE UNIQUE INDEX "ClassPlanUnit_workId_key" ON "ClassPlanUnit"("workId");
CREATE INDEX "ClassPlanUnit_planId_idx" ON "ClassPlanUnit"("planId");

ALTER TABLE "ClassPlan" ADD CONSTRAINT "ClassPlan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassPlanUnit" ADD CONSTRAINT "ClassPlanUnit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ClassPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassPlanUnit" ADD CONSTRAINT "ClassPlanUnit_workId_fkey" FOREIGN KEY ("workId") REFERENCES "SchoolWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bible reading plans: a dated schedule of passages, stored per household.

CREATE TABLE "ReadingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReadingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReadingDay" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "passage" TEXT NOT NULL,
    CONSTRAINT "ReadingDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReadingDay_planId_day_key" ON "ReadingDay"("planId", "day");
CREATE INDEX "ReadingDay_planId_day_idx" ON "ReadingDay"("planId", "day");

ALTER TABLE "ReadingDay" ADD CONSTRAINT "ReadingDay_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "ReadingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

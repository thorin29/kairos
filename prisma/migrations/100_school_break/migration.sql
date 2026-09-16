-- Planned breaks (fall/spring break, estimated vacations) inside the school year.
CREATE TABLE IF NOT EXISTS "SchoolBreak" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate"   DATE NOT NULL,
  "planned"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolBreak_pkey" PRIMARY KEY ("id")
);

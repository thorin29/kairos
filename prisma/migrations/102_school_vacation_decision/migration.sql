-- Per-vacation decision: shift school work off it (default) or keep school running.
CREATE TABLE IF NOT EXISTS "SchoolVacationDecision" (
  "id"              TEXT NOT NULL,
  "eventId"         TEXT NOT NULL,
  "schoolContinues" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolVacationDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolVacationDecision_eventId_key" ON "SchoolVacationDecision"("eventId");

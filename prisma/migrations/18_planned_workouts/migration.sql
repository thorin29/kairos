-- Named workouts per weekday: the building blocks of a person's weekly plan.
-- A weekday can hold several (e.g. "Legs" and "Chest"). Safe to re-run.
CREATE TABLE IF NOT EXISTS "PlannedWorkout" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "name"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannedWorkout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlannedWorkout_userId_dayOfWeek_idx" ON "PlannedWorkout"("userId", "dayOfWeek");
ALTER TABLE "PlannedWorkout" DROP CONSTRAINT IF EXISTS "PlannedWorkout_userId_fkey";
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

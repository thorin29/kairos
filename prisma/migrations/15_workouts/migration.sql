-- Workouts reshaped from "admin assigns a routine that becomes a daily
-- checkbox" into a personal training log: each person defines their own
-- exercises, optionally schedules them by weekday, and records what they did.
-- The old routine/log tables are retired. Written to be safely re-runnable.

DROP TABLE IF EXISTS "ExerciseLog" CASCADE;
DROP TABLE IF EXISTS "RoutineAssignment" CASCADE;
DROP TABLE IF EXISTS "RoutineExercise" CASCADE;
DROP TABLE IF EXISTS "ExerciseRoutine" CASCADE;

DROP TYPE IF EXISTS "WorkoutCategory" CASCADE;
CREATE TYPE "WorkoutCategory" AS ENUM ('WEIGHTS', 'RUNNING', 'ROWING', 'SPORT', 'STRETCHING', 'HIIT', 'ISOMETRIC');

DROP TYPE IF EXISTS "WorkoutImplement" CASCADE;
CREATE TYPE "WorkoutImplement" AS ENUM ('BARBELL', 'DUMBBELL', 'KETTLEBELL', 'BODYWEIGHT', 'NONE');

DROP TYPE IF EXISTS "WorkoutMetric" CASCADE;
CREATE TYPE "WorkoutMetric" AS ENUM ('WEIGHT', 'DISTANCE', 'METERS', 'DURATION', 'REPS');

CREATE TABLE IF NOT EXISTS "Exercise" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "category"  "WorkoutCategory" NOT NULL,
    "name"      TEXT NOT NULL,
    "implement" "WorkoutImplement",
    "unit"      TEXT NOT NULL,
    "metric"    "WorkoutMetric" NOT NULL DEFAULT 'WEIGHT',
    "tracked"   BOOLEAN NOT NULL DEFAULT true,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Exercise_userId_category_isActive_idx" ON "Exercise"("userId", "category", "isActive");
ALTER TABLE "Exercise" DROP CONSTRAINT IF EXISTS "Exercise_userId_fkey";
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "WorkoutSchedule" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "exerciseId"    TEXT NOT NULL,
    "dayOfWeek"     INTEGER NOT NULL,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "isPaused"      BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" DATE NOT NULL,
    "endDate"       DATE,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutSchedule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutSchedule_exerciseId_dayOfWeek_key" ON "WorkoutSchedule"("exerciseId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "WorkoutSchedule_userId_dayOfWeek_isActive_idx" ON "WorkoutSchedule"("userId", "dayOfWeek", "isActive");
ALTER TABLE "WorkoutSchedule" DROP CONSTRAINT IF EXISTS "WorkoutSchedule_userId_fkey";
ALTER TABLE "WorkoutSchedule" ADD CONSTRAINT "WorkoutSchedule_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkoutSchedule" DROP CONSTRAINT IF EXISTS "WorkoutSchedule_exerciseId_fkey";
ALTER TABLE "WorkoutSchedule" ADD CONSTRAINT "WorkoutSchedule_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "WorkoutSession" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "date"        DATE NOT NULL,
    "durationMin" INTEGER,
    "finished"    BOOLEAN NOT NULL DEFAULT true,
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkoutSession_userId_date_idx" ON "WorkoutSession"("userId", "date");
ALTER TABLE "WorkoutSession" DROP CONSTRAINT IF EXISTS "WorkoutSession_userId_fkey";
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SessionSet" (
    "id"         TEXT NOT NULL,
    "sessionId"  TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber"  INTEGER NOT NULL DEFAULT 1,
    "reps"       INTEGER,
    "weight"     DOUBLE PRECISION,
    "distance"   DOUBLE PRECISION,
    "meters"     DOUBLE PRECISION,
    "seconds"    INTEGER,
    "unit"       TEXT,
    "finished"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionSet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SessionSet_sessionId_exerciseId_setNumber_key" ON "SessionSet"("sessionId", "exerciseId", "setNumber");
CREATE INDEX IF NOT EXISTS "SessionSet_exerciseId_idx" ON "SessionSet"("exerciseId");
ALTER TABLE "SessionSet" DROP CONSTRAINT IF EXISTS "SessionSet_sessionId_fkey";
ALTER TABLE "SessionSet" ADD CONSTRAINT "SessionSet_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionSet" DROP CONSTRAINT IF EXISTS "SessionSet_exerciseId_fkey";
ALTER TABLE "SessionSet" ADD CONSTRAINT "SessionSet_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

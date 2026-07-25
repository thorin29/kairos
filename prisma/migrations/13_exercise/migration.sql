-- Exercise: admin-defined routines, assigned to people by weekday, generated
-- into daily tasks like chores — plus a place to log what was actually done.
--
-- Written to be safely re-runnable: an earlier version of this migration
-- created these tables before failing on a later statement, so every object
-- here is guarded so it applies whether or not it already exists.

CREATE TABLE IF NOT EXISTS "ExerciseRoutine" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "notes"     TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExerciseRoutine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RoutineExercise" (
    "id"        TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "sets"      INTEGER NOT NULL DEFAULT 3,
    "reps"      TEXT NOT NULL DEFAULT '10',
    "weight"    TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RoutineExercise_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RoutineExercise_routineId_idx" ON "RoutineExercise"("routineId");
ALTER TABLE "RoutineExercise" DROP CONSTRAINT IF EXISTS "RoutineExercise_routineId_fkey";
ALTER TABLE "RoutineExercise" ADD CONSTRAINT "RoutineExercise_routineId_fkey"
    FOREIGN KEY ("routineId") REFERENCES "ExerciseRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "RoutineAssignment" (
    "id"        TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutineAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RoutineAssignment_routineId_userId_dayOfWeek_key"
    ON "RoutineAssignment"("routineId", "userId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "RoutineAssignment_dayOfWeek_isActive_idx"
    ON "RoutineAssignment"("dayOfWeek", "isActive");
ALTER TABLE "RoutineAssignment" DROP CONSTRAINT IF EXISTS "RoutineAssignment_routineId_fkey";
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_routineId_fkey"
    FOREIGN KEY ("routineId") REFERENCES "ExerciseRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineAssignment" DROP CONSTRAINT IF EXISTS "RoutineAssignment_userId_fkey";
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ExerciseLog" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "day"        DATE NOT NULL,
    "sets"       INTEGER,
    "reps"       INTEGER,
    "weight"     DOUBLE PRECISION,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExerciseLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExerciseLog_userId_exerciseId_day_key"
    ON "ExerciseLog"("userId", "exerciseId", "day");
CREATE INDEX IF NOT EXISTS "ExerciseLog_exerciseId_userId_day_idx"
    ON "ExerciseLog"("exerciseId", "userId", "day");
ALTER TABLE "ExerciseLog" DROP CONSTRAINT IF EXISTS "ExerciseLog_userId_fkey";
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExerciseLog" DROP CONSTRAINT IF EXISTS "ExerciseLog_exerciseId_fkey";
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "RoutineExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

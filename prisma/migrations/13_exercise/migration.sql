-- Exercise: admin-defined routines, assigned to people by weekday, generated
-- into daily tasks like chores — plus a place to log what was actually done.
--
-- A Routine is a named workout with an ordered list of movements (sets, reps,
-- a weight hint). A RoutineAssignment puts a routine on a person's given
-- weekday. The generator turns active assignments into daily EXERCISE tasks,
-- reconciling the same way chores do. An ExerciseLog records the real sets,
-- reps, and weight for one movement on one day, so progress can be seen.

CREATE TABLE "ExerciseRoutine" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "notes"     TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExerciseRoutine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutineExercise" (
    "id"        TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "sets"      INTEGER NOT NULL DEFAULT 3,
    "reps"      TEXT NOT NULL DEFAULT '10',
    "weight"    TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RoutineExercise_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RoutineExercise_routineId_idx" ON "RoutineExercise"("routineId");
ALTER TABLE "RoutineExercise" ADD CONSTRAINT "RoutineExercise_routineId_fkey"
    FOREIGN KEY ("routineId") REFERENCES "ExerciseRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RoutineAssignment" (
    "id"        TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutineAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoutineAssignment_routineId_userId_dayOfWeek_key"
    ON "RoutineAssignment"("routineId", "userId", "dayOfWeek");
CREATE INDEX "RoutineAssignment_dayOfWeek_isActive_idx"
    ON "RoutineAssignment"("dayOfWeek", "isActive");
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_routineId_fkey"
    FOREIGN KEY ("routineId") REFERENCES "ExerciseRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineAssignment" ADD CONSTRAINT "RoutineAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExerciseLog" (
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
CREATE UNIQUE INDEX "ExerciseLog_userId_exerciseId_day_key"
    ON "ExerciseLog"("userId", "exerciseId", "day");
CREATE INDEX "ExerciseLog_exerciseId_userId_day_idx"
    ON "ExerciseLog"("exerciseId", "userId", "day");
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "RoutineExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Generated tasks (chores and now exercise) carry the assignment id in
-- generatedFrom; one task per assignment per day. This makes generation
-- idempotent for tasks that aren't keyed by a chore. Hand-added tasks have a
-- NULL generatedFrom and Postgres treats NULLs as distinct, so they're exempt.
CREATE UNIQUE INDEX "Task_generatedFrom_dueDate_key"
    ON "Task"("generatedFrom", "dueDate")
    WHERE "generatedFrom" IS NOT NULL;

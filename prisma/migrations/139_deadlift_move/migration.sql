-- Move every deadlift (Romanian, sumo, trap bar, kettlebell, single-leg…) into
-- the Deadlift group (v0.619.0), and the plans with them. Idempotent: running
-- it again finds nothing left to move.

-- 1. The movements.
UPDATE "PoolExercise"
   SET "muscleGroup" = 'DEADLIFT'
 WHERE "category" = 'WEIGHTS'
   AND lower("name") LIKE '%deadlift%'
   AND ("muscleGroup" IS NULL OR "muscleGroup" <> 'DEADLIFT');

-- 2. A planned Weights workout holding only deadlifts becomes a Deadlift
--    workout; its name follows when it was just the old group's label.
UPDATE "PlannedWorkout" pw
   SET "muscleGroup" = 'DEADLIFT',
       "name" = CASE WHEN pw."name" IN ('Core', 'Legs', 'Back', 'Full body') THEN 'Deadlift' ELSE pw."name" END
 WHERE pw."category" = 'WEIGHTS'
   AND pw."muscleGroup" IS DISTINCT FROM 'DEADLIFT'
   AND EXISTS (SELECT 1 FROM "PlannedExercise" pe WHERE pe."plannedWorkoutId" = pw."id")
   AND NOT EXISTS (
     SELECT 1 FROM "PlannedExercise" pe
       JOIN "PoolExercise" px ON px."id" = pe."poolExerciseId"
      WHERE pe."plannedWorkoutId" = pw."id" AND px."muscleGroup" IS DISTINCT FROM 'DEADLIFT'
   );

-- 3. One mixing a deadlift with other movements (Core: deadlift + planks)
--    keeps the others; the deadlifts move to a new Deadlift workout on the
--    same day, right after it.
DO $$
DECLARE
  r RECORD;
  new_id TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT pw."id", pw."userId", pw."dayOfWeek", pw."sortOrder", pw."createdAt"
      FROM "PlannedWorkout" pw
      JOIN "PlannedExercise" pe ON pe."plannedWorkoutId" = pw."id"
      JOIN "PoolExercise" px ON px."id" = pe."poolExerciseId"
     WHERE pw."category" = 'WEIGHTS'
       AND pw."muscleGroup" IS DISTINCT FROM 'DEADLIFT'
       AND px."muscleGroup" = 'DEADLIFT'
  LOOP
    new_id := 'dl' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO "PlannedWorkout" ("id", "userId", "dayOfWeek", "name", "category", "muscleGroup", "isRest", "sortOrder", "createdAt")
    VALUES (new_id, r."userId", r."dayOfWeek", 'Deadlift', 'WEIGHTS', 'DEADLIFT', false, r."sortOrder", r."createdAt");
    UPDATE "PlannedExercise" pe
       SET "plannedWorkoutId" = new_id
      FROM "PoolExercise" px
     WHERE pe."plannedWorkoutId" = r."id"
       AND px."id" = pe."poolExerciseId"
       AND px."muscleGroup" = 'DEADLIFT';
  END LOOP;
END $$;

-- 4. A timed movement a program wrote as weight × reps (planks) logs by time
--    again, with no set structure (v0.619.0).
UPDATE "PlannedExercise" pe
   SET "metric" = 'DURATION', "scheme" = NULL
  FROM "PoolExercise" px
 WHERE px."id" = pe."poolExerciseId"
   AND px."metric" = 'DURATION'
   AND pe."programRole" IS NOT NULL
   AND pe."metric" IS DISTINCT FROM 'DURATION';

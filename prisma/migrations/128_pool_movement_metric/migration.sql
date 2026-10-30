-- How a movement is logged, on the movement itself (v0.609.0). Null = the
-- category's default (weights log weight × reps). New plan entries take it;
-- a plan entry's own metric still wins. Idempotent.
ALTER TABLE "PoolExercise" ADD COLUMN IF NOT EXISTS "metric" "WorkoutMetric";

-- Holds are timed. Same words as `isHoldName` in src/lib/workouts/catalog.ts.
UPDATE "PoolExercise"
SET "metric" = 'DURATION'
WHERE "metric" IS NULL
  AND "name" ~* '\m(planks?|wall sits?|dead hangs?|hollow (holds?|body)|l-sits?|holds?)\M';

-- Plan entries for those holds that ask for weight (or nothing) switch to
-- time, unless the person has logged a real weight for the movement (a plate
-- on the back is a weighted plank).
UPDATE "PlannedExercise" pe
SET "metric" = 'DURATION'
FROM "PoolExercise" p, "PlannedWorkout" pw
WHERE pe."poolExerciseId" = p."id"
  AND pw."id" = pe."plannedWorkoutId"
  AND p."metric" = 'DURATION'
  AND (pe."metric" IS NULL OR pe."metric" = 'WEIGHT')
  AND NOT EXISTS (
    SELECT 1
    FROM "SessionSet" s
    JOIN "WorkoutSession" w ON w."id" = s."sessionId"
    WHERE s."poolExerciseId" = p."id"
      AND w."userId" = pw."userId"
      AND s."weight" IS NOT NULL
      AND s."weight" > 0
  );

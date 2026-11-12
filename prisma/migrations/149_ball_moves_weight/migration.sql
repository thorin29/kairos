-- Medicine ball and slam ball moves log weight and reps (v0.676.1), not reps
-- alone: the movements, and the plan entries that ask for them.
UPDATE "PoolExercise" SET "metric" = 'WEIGHT'
WHERE "metric" = 'REPS'
  AND "name" IN ('Chest pass', 'Rotational throw', 'Sit-up throw', 'Rotational slam', 'Ball slam', 'Over-shoulder toss', 'Wall ball', 'Overhead throw');

UPDATE "PlannedExercise" SET "metric" = 'WEIGHT'
WHERE "metric" = 'REPS'
  AND "poolExerciseId" IN (
    SELECT "id" FROM "PoolExercise"
    WHERE "name" IN ('Chest pass', 'Rotational throw', 'Sit-up throw', 'Rotational slam', 'Ball slam', 'Over-shoulder toss', 'Wall ball', 'Overhead throw')
  );

-- Let a logged set point at a shared PoolExercise, so the same movement is
-- comparable across people. Additive: exerciseId becomes optional and a new
-- nullable poolExerciseId is added. Safe to re-run.

ALTER TABLE "SessionSet" ALTER COLUMN "exerciseId" DROP NOT NULL;
ALTER TABLE "SessionSet" ADD COLUMN IF NOT EXISTS "poolExerciseId" TEXT;

CREATE INDEX IF NOT EXISTS "SessionSet_poolExerciseId_idx"
    ON "SessionSet"("poolExerciseId");

ALTER TABLE "SessionSet" DROP CONSTRAINT IF EXISTS "SessionSet_poolExerciseId_fkey";
ALTER TABLE "SessionSet" ADD CONSTRAINT "SessionSet_poolExerciseId_fkey"
    FOREIGN KEY ("poolExerciseId") REFERENCES "PoolExercise"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

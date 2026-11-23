-- Which program wrote a plan entry (v0.749), so two programs can run at once
-- and each changes and ends only its own. Today's running program owns the
-- entries holding its program lifts; everything else stays the plan's own.
ALTER TABLE "PlannedWorkout" ADD COLUMN "programId" TEXT;
CREATE INDEX "PlannedWorkout_programId_idx" ON "PlannedWorkout"("programId");

UPDATE "PlannedWorkout" pw
SET "programId" = pp."id"
FROM "PersonProgram" pp
WHERE pp."userId" = pw."userId"
  AND pp."status" = 'ACTIVE'
  AND EXISTS (
    SELECT 1 FROM "PlannedExercise" pe
    WHERE pe."plannedWorkoutId" = pw."id" AND pe."programRole" IS NOT NULL
  );

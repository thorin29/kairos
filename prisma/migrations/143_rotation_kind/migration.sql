-- Arms days (v0.651): a person's own rotation workouts say what they train.
ALTER TABLE "CoreWorkout" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'core';
CREATE INDEX "CoreWorkout_ownerId_kind_idx" ON "CoreWorkout"("ownerId", "kind");

-- Core days (v0.637.0). A person's own core workouts: a name and a list of
-- movements with their sets, kept as JSON. A Core plan entry carries its
-- rotation in `core` (JSON: the workouts in order, the monthly plank test,
-- where the rotation is). Library core workouts are defined in code
-- ("lib:<key>"). Idempotent.
CREATE TABLE IF NOT EXISTS "CoreWorkout" (
  "id"        TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "moves"     JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoreWorkout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CoreWorkout_ownerId_idx" ON "CoreWorkout"("ownerId");
DO $$ BEGIN
  ALTER TABLE "CoreWorkout" ADD CONSTRAINT "CoreWorkout_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "PlannedWorkout" ADD COLUMN IF NOT EXISTS "core" JSONB;

-- Flag a named workout as a Hero WOD (CrossFit benchmarks named for the fallen).
ALTER TABLE "HiitWorkout" ADD COLUMN IF NOT EXISTS "heroWod" BOOLEAN NOT NULL DEFAULT false;

-- Front-load extra items so a plan finishes by the last term day (catch-up).
ALTER TABLE "ClassPlan" ADD COLUMN IF NOT EXISTS "fitToTerm" BOOLEAN NOT NULL DEFAULT false;

-- A paused class plan (v0.702): no schedule, one open item at a time.
ALTER TABLE "ClassPlan" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;

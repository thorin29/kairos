-- Events (and, later, subscribed calendars) can belong to the shared "Family"
-- identity instead of a person. userId becomes optional; isFamily marks those
-- rows. Safe to re-run.
ALTER TABLE "Event" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "isFamily" BOOLEAN NOT NULL DEFAULT false;

-- Sport calendar events → workouts: an event type can be flagged as a sport
-- workout, and a workout session can record the event it came from (so the
-- link is idempotent per person/day/event). Additive and re-runnable.

ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "sportWorkout" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "sourceEventId" TEXT;
CREATE INDEX IF NOT EXISTS "WorkoutSession_sourceEventId_idx" ON "WorkoutSession"("sourceEventId");

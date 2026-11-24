-- Workouts (v0.777): a walk, run, ruck or hike tracked with the phone's GPS —
-- the route behind one cardio session, shown on Family map History.

CREATE TABLE IF NOT EXISTS "WorkoutTrack" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "movingSec" INTEGER NOT NULL,
  "distanceM" DOUBLE PRECISION NOT NULL,
  "path" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkoutTrack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutTrack_sessionId_key" ON "WorkoutTrack"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutTrack_clientId_key" ON "WorkoutTrack"("clientId");
CREATE INDEX IF NOT EXISTS "WorkoutTrack_userId_startAt_idx" ON "WorkoutTrack"("userId", "startAt");
DO $$ BEGIN
  ALTER TABLE "WorkoutTrack" ADD CONSTRAINT "WorkoutTrack_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkoutTrack" ADD CONSTRAINT "WorkoutTrack_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

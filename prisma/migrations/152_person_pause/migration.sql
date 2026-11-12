-- One person's pause (v0.688): Admin → Calendar → Vacations & pauses can pause
-- one person's chores and workouts (away at camp, say). Null is the
-- household's pause, as before.
ALTER TABLE "Pause" ADD COLUMN "userId" TEXT;
CREATE INDEX "Pause_userId_idx" ON "Pause"("userId");
ALTER TABLE "Pause" ADD CONSTRAINT "Pause_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A person's workout pause (v0.678): sick, injured or otherwise off for a few
-- days. No workout prompts, missed days or cooling on the heat map while it
-- runs. A household pause (Pause) pauses everyone the same way.
CREATE TABLE "WorkoutPause" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutPause_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkoutPause_userId_endDate_idx" ON "WorkoutPause"("userId", "endDate");
ALTER TABLE "WorkoutPause" ADD CONSTRAINT "WorkoutPause_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

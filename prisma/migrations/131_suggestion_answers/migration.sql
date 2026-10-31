-- Answers to workout suggestions, per person and day (v0.612.0). Answering a
-- card hides it for the day. key "day" holds a lighter day ("light" / "ease").
-- slot is the planned movement for a movement card, '' for the day's. Idempotent.
CREATE TABLE IF NOT EXISTS "WorkoutSuggestionAnswer" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "key" TEXT NOT NULL,
    "slot" TEXT NOT NULL DEFAULT '',
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutSuggestionAnswer_pkey" PRIMARY KEY ("userId", "date", "key", "slot")
);

DO $$ BEGIN
  ALTER TABLE "WorkoutSuggestionAnswer" ADD CONSTRAINT "WorkoutSuggestionAnswer_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

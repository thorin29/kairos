-- Concept2 Logbook rows (v0.614.0): one row per result taken, so a result is
-- never imported twice. `sessionId` is the workout it became (null once
-- undone); `replaced` keeps a hand-entered row it replaced, for Undo;
-- `dismissed` means Undo was used and the result stays out. Idempotent.
CREATE TABLE IF NOT EXISTS "Concept2Result" (
  "userId"    TEXT NOT NULL,
  "resultId"  TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "meters"    INTEGER NOT NULL DEFAULT 0,
  "seconds"   INTEGER NOT NULL DEFAULT 0,
  "sessionId" TEXT,
  "replaced"  JSONB,
  "dismissed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Concept2Result_pkey" PRIMARY KEY ("userId", "resultId")
);
CREATE INDEX IF NOT EXISTS "Concept2Result_userId_date_idx" ON "Concept2Result"("userId", "date");
DO $$ BEGIN
  ALTER TABLE "Concept2Result" ADD CONSTRAINT "Concept2Result_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

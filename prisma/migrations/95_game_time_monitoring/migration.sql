-- Game-time monitoring: person identity fields + daily rollups + player status.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gamertag" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "steamId" TEXT;

CREATE TABLE IF NOT EXISTS "GameDay" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "minutes" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "GameDay_userId_date_key" ON "GameDay"("userId", "date");

CREATE TABLE IF NOT EXISTS "GameDayTitle" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "game" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "GameDayTitle_userId_date_game_key" ON "GameDayTitle"("userId", "date", "game");

CREATE TABLE IF NOT EXISTS "PlayerCard" (
  "userId" TEXT PRIMARY KEY,
  "gamerscore" INTEGER,
  "gamerpic" TEXT,
  "hasGamePass" BOOLEAN,
  "msBalance" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "GameDay" ADD CONSTRAINT "GameDay_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "GameDayTitle" ADD CONSTRAINT "GameDayTitle_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlayerCard" ADD CONSTRAINT "PlayerCard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

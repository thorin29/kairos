-- Screen time: a daily allowance plus scarce weekly tokens for extra minutes.

CREATE TABLE "GameProfile" (
    "userId" TEXT NOT NULL,
    "dailyMinutes" INTEGER NOT NULL DEFAULT 60,
    "weeklyTokens" INTEGER NOT NULL DEFAULT 3,
    "tokenMinutes" INTEGER NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "usedToken" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GameSession_userId_day_idx" ON "GameSession"("userId", "day");
CREATE INDEX "GameSession_day_idx" ON "GameSession"("day");

ALTER TABLE "GameProfile" ADD CONSTRAINT "GameProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

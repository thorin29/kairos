-- Program versions (v0.666): a person's own setup of a program, kept when
-- they end or switch it so they can start from it again.
CREATE TABLE "ProgramVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programKey" TEXT NOT NULL,
    "setup" JSONB NOT NULL,
    "savedOn" DATE NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgramVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgramVersion_userId_programKey_key" ON "ProgramVersion"("userId", "programKey");
ALTER TABLE "ProgramVersion" ADD CONSTRAINT "ProgramVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

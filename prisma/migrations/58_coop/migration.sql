-- Family co-op: a shared seasonal goal the children fill together, plus reward
-- voting. Kids (or anyone) propose a family reward, everyone votes, an admin
-- selects the season's reward, and grants it once every child clears the
-- participation floor. These are choices/events, not recomputable from history,
-- so they need their own tables.
--
-- Idempotent: guarded enum, IF NOT EXISTS tables/indexes, guarded FKs.

DO $$ BEGIN
  CREATE TYPE "CoopStatus" AS ENUM ('PROPOSED', 'SELECTED', 'GRANTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "CoopProposal" (
  "id"           TEXT NOT NULL,
  "seasonKey"    TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "detail"       TEXT,
  "proposedById" TEXT NOT NULL,
  "status"       "CoopStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoopProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CoopVote" (
  "id"         TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoopVote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoopProposal_seasonKey_idx" ON "CoopProposal"("seasonKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CoopVote_proposalId_userId_key" ON "CoopVote"("proposalId", "userId");

DO $$ BEGIN
  ALTER TABLE "CoopProposal" ADD CONSTRAINT "CoopProposal_proposedById_fkey"
    FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoopVote" ADD CONSTRAINT "CoopVote_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "CoopProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoopVote" ADD CONSTRAINT "CoopVote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

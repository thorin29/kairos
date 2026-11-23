-- A program's cycle number and what its main lifts went up by when the cycle
-- began (v0.748), for the success marks. Running programs start at cycle 1.
ALTER TABLE "PersonProgram" ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PersonProgram" ADD COLUMN "lastRaises" JSONB NOT NULL DEFAULT '{}';

-- v0.783: 5/3/1's 7th-week protocol. A running 5/3/1 keeps its current
-- 4-week cycle: its 4th week becomes the 7th week (a deload when it's already
-- under way, asked otherwise).
ALTER TABLE "PersonProgram" ADD COLUMN "seventhWeek" TEXT;

UPDATE "PersonProgram"
SET "seventhWeek" = CASE WHEN (CURRENT_DATE - "blockStartedOn") >= 21 THEN 'deload' ELSE 'ask' END
WHERE "programKey" = 'wendler-531' AND "status" = 'ACTIVE';

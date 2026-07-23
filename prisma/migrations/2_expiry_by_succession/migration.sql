-- Chores expire only when the same chore comes due again, never on a timer.
ALTER TABLE "Chore" DROP COLUMN IF EXISTS "staleAfterDays";

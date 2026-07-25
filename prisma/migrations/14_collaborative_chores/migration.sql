-- Collaborative chores: one chore assigned to several people, where each of
-- them has to do their part. Mechanically that's just several assignments of
-- the same chore, so the only new state is a flag to label it as shared work
-- and a week interval so it can recur less often than weekly (every other
-- week, say). Guarded so the migration is safe to re-run.

ALTER TABLE "Chore" ADD COLUMN IF NOT EXISTS "isCollaborative" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Chore" ADD COLUMN IF NOT EXISTS "intervalWeeks" INTEGER NOT NULL DEFAULT 1;

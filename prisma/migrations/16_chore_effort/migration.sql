-- An admin-only effort weight per chore (1 easy, 2 average, 3 hard), so the
-- admin can see whether the week's chores are balanced across the family.
-- Never surfaced to normal users. Guarded so it's safe to re-run.
ALTER TABLE "Chore" ADD COLUMN IF NOT EXISTS "effort" INTEGER NOT NULL DEFAULT 2;

-- Per-user custom movements: a PoolExercise owned by a user shows only in their
-- menus. NULL owner = the shared/admin catalog.
ALTER TABLE "PoolExercise" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

DO $$ BEGIN
  ALTER TABLE "PoolExercise"
    ADD CONSTRAINT "PoolExercise_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Allow the same movement name across different owners.
DROP INDEX IF EXISTS "PoolExercise_category_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PoolExercise_category_name_ownerId_key"
  ON "PoolExercise" ("category", "name", "ownerId");

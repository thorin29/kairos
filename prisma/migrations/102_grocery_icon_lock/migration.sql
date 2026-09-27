-- Let an admin lock a catalog item's icon so a catalog re-sync leaves it alone
-- instead of re-guessing it from the name. Nullable-safe: existing rows default
-- to unlocked, i.e. current behavior.
ALTER TABLE "GroceryItem" ADD COLUMN IF NOT EXISTS "iconLocked" BOOLEAN NOT NULL DEFAULT false;

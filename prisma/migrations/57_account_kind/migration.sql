-- Account kind: Child or Parent, kept separate from the admin permission.
-- A child is never an admin; a parent may or may not be. This is what the
-- kid-focused features (companions, the co-op participation gate) scope to.
--
-- Additive and idempotent: the column defaults to CHILD, then existing admins
-- are promoted to PARENT so the "admins are parents" invariant holds from the
-- first deploy. Everyone else stays CHILD until an admin flags them a parent.

DO $$ BEGIN
  CREATE TYPE "AccountKind" AS ENUM ('CHILD', 'PARENT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "kind" "AccountKind" NOT NULL DEFAULT 'CHILD';

UPDATE "User" SET "kind" = 'PARENT' WHERE "role" = 'ADMIN';

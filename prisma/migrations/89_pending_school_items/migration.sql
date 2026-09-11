-- User-proposed subjects/terms await admin approval before joining the shared pools.
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "pending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "proposedById" TEXT;
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "pending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "proposedById" TEXT;

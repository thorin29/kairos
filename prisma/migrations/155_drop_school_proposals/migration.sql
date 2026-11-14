-- v0.714: no more class approvals. Subjects and semesters are added by an admin
-- only, so the proposal columns go. Anything still pending is kept as a
-- normal subject or semester (the columns are simply dropped).
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "pending";
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "proposedById";
ALTER TABLE "Term" DROP COLUMN IF EXISTS "pending";
ALTER TABLE "Term" DROP COLUMN IF EXISTS "proposedById";

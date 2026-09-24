-- Base subject groups granular subjects under a shared colour (Math, Science, …).
ALTER TABLE "Subject" ADD COLUMN "baseSubject" TEXT;

UPDATE "Subject" SET "baseSubject" = 'Math'
  WHERE "name" IN ('Geometry', 'Pre-Algebra', 'Pre-algebra', 'Algebra', 'Calculus');
UPDATE "Subject" SET "baseSubject" = 'Science'
  WHERE "name" IN ('Science', 'Geology', 'Biology', 'Chemistry', 'Physics');
UPDATE "Subject" SET "baseSubject" = 'Foreign Language'
  WHERE "name" IN ('Spanish');
UPDATE "Subject" SET "baseSubject" = 'History'
  WHERE "name" IN ('Geography', 'History');
UPDATE "Subject" SET "baseSubject" = 'Writing'
  WHERE "name" IN ('Grammar', 'Writing', 'Handwriting');

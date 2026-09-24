-- The colour group is the subject itself now (classes hang under subjects).
-- Seed each subject's colour from the base subject it was under so the grouping
-- carries over as a starting point; the base-subject table is left in place but
-- no longer drives colours.
UPDATE "Subject" s
SET "color" = b."color"
FROM "BaseSubject" b
WHERE s."baseSubjectId" = b."id" AND b."color" IS NOT NULL AND s."color" IS NULL;

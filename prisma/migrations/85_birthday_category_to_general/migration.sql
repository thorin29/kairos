-- "Birthday" is no longer an offered address category. Move any existing rows
-- that used it to "General". Idempotent.
UPDATE "SavedAddress" SET "category" = 'General' WHERE "category" = 'Birthday';

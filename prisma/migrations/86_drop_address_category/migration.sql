-- Categories are retired: the address book is one flat searchable list.
ALTER TABLE "SavedAddress" DROP COLUMN IF EXISTS "category";

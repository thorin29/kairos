-- Family map (v0.768): "Not right?" looks up what's typed and keeps its address.
-- "Just the address" is gone; the spots it made only hid business names.

ALTER TABLE "PlaceName" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "PlaceName" ADD COLUMN IF NOT EXISTS "googlePlaceId" TEXT;
DELETE FROM "PlaceName" WHERE "name" IS NULL;

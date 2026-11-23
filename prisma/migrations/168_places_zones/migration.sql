-- Places (v0.760): Home Assistant zones on points and in notification rules.

ALTER TABLE "LocationPoint" ADD COLUMN IF NOT EXISTS "zone" TEXT;
ALTER TABLE "PlacesNotifyRule" ADD COLUMN IF NOT EXISTS "zone" TEXT;

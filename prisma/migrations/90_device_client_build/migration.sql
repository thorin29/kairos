-- Record each phone's reported app build so the Family page can list versions.
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "clientBuild" INTEGER;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "clientVersion" TEXT;

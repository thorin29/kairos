-- Increment B: tie a device to the account password version it authenticated at.
-- When an account with a password rotates/disables it (credentialVersion bumps),
-- the device no longer matches and must re-authenticate (it stays enrolled).
-- Passwordless accounts never bump, so their devices are unaffected. Idempotent.

ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "credentialVersion" INTEGER NOT NULL DEFAULT 0;

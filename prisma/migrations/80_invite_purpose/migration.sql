-- Invite purpose: "join" (default) sets a new account's password or confirms an
-- existing one and enrolls the device (setup / add a phone). "reset" always sets
-- a NEW password even when the account already has one — the forgot-password
-- flow, where the person can't confirm the old one. Additive; existing invites
-- default to "join".
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'join';

-- Per-person device enrollment for the mobile client (docs/API.md "identity").
-- A Device binds a phone to a person; on mobile its token is that person's
-- identity. An EnrollmentCode is the one-time, admin-issued secret a parent uses
-- to enroll a device. Both store only a hash of their secret, like Invite.
-- Idempotent.

CREATE TABLE IF NOT EXISTS "Device" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "name"       TEXT,
  "tokenHash"  TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3),
  "revokedAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EnrollmentCode" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "codeHash"  TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnrollmentCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Device_tokenHash_key" ON "Device"("tokenHash");
CREATE INDEX IF NOT EXISTS "Device_userId_idx" ON "Device"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "EnrollmentCode_codeHash_key" ON "EnrollmentCode"("codeHash");
CREATE INDEX IF NOT EXISTS "EnrollmentCode_userId_idx" ON "EnrollmentCode"("userId");

DO $$ BEGIN
  ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "EnrollmentCode" ADD CONSTRAINT "EnrollmentCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

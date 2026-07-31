-- First-party personal accounts. Additive and non-regressive: a person's User
-- row gains an optional password credential, and with none set they stay a
-- wall-tablet-only profile (young children), exactly as before. Login identity
-- is the existing unique `name` — no email column, because re-issuing an invite
-- is how a password is reset, which suits a household with kids.
--
-- Sessions stay stateless signed cookies (no session table, matching the admin
-- session). `credentialVersion` is embedded in the personal cookie, so bumping
-- it — on a password change or an admin disabling a login — invalidates that
-- person's existing sessions without a server-side session store.
--
-- There is deliberately no self-signup. An account only becomes loginable when
-- an admin issues an Invite (a one-time, hashed, expiring token) and the person
-- redeems it to set their password. Re-runnable.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "credentialVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "Invite" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- Tokens are looked up by their hash; the raw token is shown once and never
-- stored. A person has at most one live invite (the action clears prior ones),
-- but that is enforced in code, not here.
CREATE UNIQUE INDEX IF NOT EXISTS "Invite_tokenHash_key" ON "Invite"("tokenHash");
CREATE INDEX IF NOT EXISTS "Invite_userId_idx" ON "Invite"("userId");

-- Removing a person cleans up any pending invite.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Invite_userId_fkey'
  ) THEN
    ALTER TABLE "Invite"
      ADD CONSTRAINT "Invite_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

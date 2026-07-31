-- An optional email per person. It's the address invites are sent to, and a
-- second way to sign in (name or email). Nullable, because a young child has
-- neither — they stay a wall-tablet-only profile and, if ever given a login,
-- sign in by name. Unique when present: Postgres allows many NULLs under a
-- unique index, so this constrains real addresses without blocking the empties.
-- Additive and re-runnable.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

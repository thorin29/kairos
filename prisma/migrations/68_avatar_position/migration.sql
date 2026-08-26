-- Where an uploaded profile photo is framed inside its circle, as a CSS
-- object-position ("50% 50%" is centred). Lets a face that sits off-centre be
-- nudged into view without re-cropping the file. Additive and idempotent.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "avatarPosition" TEXT NOT NULL DEFAULT '50% 50%';

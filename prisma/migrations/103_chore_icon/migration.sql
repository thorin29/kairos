-- Optional badge glyph key for a chore ("grass", "water", ...), shown after
-- the Chores summary line when the chore is completed today.
ALTER TABLE "Chore" ADD COLUMN "icon" TEXT;

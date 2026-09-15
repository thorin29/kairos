-- Which game systems each person uses (for the per-system icon on the Game time page).
ALTER TABLE "PlayerCard" ADD COLUMN IF NOT EXISTS "platforms" TEXT;

-- v0.697: switching characters keeps every bit of growth with the one that
-- earned it.
--
-- growthBanked was INTEGER (added in 121, when growth was whole squares).
-- Since 0.603 a day can be worth part of a square, so banking 2.33 stored 2
-- and the fraction was lost on every switch. Stored as a double now.
ALTER TABLE "Companion" ALTER COLUMN "growthBanked" TYPE DOUBLE PRECISION;

-- Today's credit already earned by the outgoing companion when this one became
-- active: subtracted from this one's tenure day, so work done before a switch
-- stays with the character that was active when it was done.
ALTER TABLE "Companion" ADD COLUMN IF NOT EXISTS "tenureCreditOffset" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Deepening progress banked when a companion goes to the gallery mid-deepen;
-- null when it was not deepening. It resumes from here when it comes back.
ALTER TABLE "Companion" ADD COLUMN IF NOT EXISTS "deepenBanked" DOUBLE PRECISION;

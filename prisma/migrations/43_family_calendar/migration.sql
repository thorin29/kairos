-- A subscribed calendar can belong to the shared "Family" identity instead of
-- one person: its whole feed then shows as Family (family colour, visible to
-- everyone) rather than being coloured by a single owner. Mirrors the Event
-- model's userId?/isFamily pair.

ALTER TABLE "ExternalCalendar"
  ADD COLUMN IF NOT EXISTS "isFamily" BOOLEAN NOT NULL DEFAULT false;

-- Owner becomes optional so a Family feed can have no person attached.
ALTER TABLE "ExternalCalendar"
  ALTER COLUMN "userId" DROP NOT NULL;

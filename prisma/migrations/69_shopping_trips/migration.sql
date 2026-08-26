-- Shopping trips: a live run for one store, claimed by one person. The row
-- exists only while the trip is active (completing/dropping deletes it), so at
-- most one per store — hence the unique storeId. A line gains a nullable tripId
-- (null = on the saved list; set = pulled into that store's active trip). The
-- existing ShoppingItem.boughtAt is repurposed as "purchased within the trip".
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS "ShoppingTrip" (
  "id"        TEXT NOT NULL,
  "storeId"   TEXT NOT NULL,
  "shopperId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShoppingTrip_pkey" PRIMARY KEY ("id")
);

-- One active trip per store.
CREATE UNIQUE INDEX IF NOT EXISTS "ShoppingTrip_storeId_key" ON "ShoppingTrip"("storeId");
CREATE INDEX IF NOT EXISTS "ShoppingTrip_shopperId_idx" ON "ShoppingTrip"("shopperId");

DO $$ BEGIN
  ALTER TABLE "ShoppingTrip" ADD CONSTRAINT "ShoppingTrip_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ShoppingTrip" ADD CONSTRAINT "ShoppingTrip_shopperId_fkey"
    FOREIGN KEY ("shopperId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Link a line to an active trip (nullable; detaches rather than deletes if the
-- trip row goes away).
ALTER TABLE "ShoppingItem"
  ADD COLUMN IF NOT EXISTS "tripId" TEXT;

CREATE INDEX IF NOT EXISTS "ShoppingItem_tripId_idx" ON "ShoppingItem"("tripId");

DO $$ BEGIN
  ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "ShoppingTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- A manual order for lines on the saved list, so items can be dragged into an
-- order and dragged between stores. Ordering reads as (sortOrder, createdAt),
-- so existing rows (all 0) keep their current by-added order until touched.
-- Additive and idempotent.
ALTER TABLE "ShoppingItem"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

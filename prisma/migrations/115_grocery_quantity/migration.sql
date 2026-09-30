-- Optional quantity on a shopping line (1-99). NULL means "no quantity", which
-- displays exactly as it always has.
ALTER TABLE "ShoppingItem" ADD COLUMN IF NOT EXISTS "quantity" INTEGER;

-- Groceries: a shared shopping list that learns.
--
-- Three tables. A Store is a place you shop (Costco, the grocery store), so a
-- list can be filtered down to just what you're there to buy. A GroceryItem is
-- the catalog — the remembered list of things this household buys, each with an
-- icon and a use count so the common ones surface first and typing the same
-- thing twice isn't necessary. A ShoppingItem is one line currently on the
-- list: a snapshot of the name and icon, which store it belongs to, who's
-- getting it, and whether it's been bought.

CREATE TABLE "Store" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "icon"      TEXT NOT NULL DEFAULT '🛒',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Store_name_key" ON "Store"("name");

CREATE TABLE "GroceryItem" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "icon"           TEXT NOT NULL DEFAULT '📦',
    "defaultStoreId" TEXT,
    "useCount"       INTEGER NOT NULL DEFAULT 0,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroceryItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroceryItem_name_key" ON "GroceryItem"("name");
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_defaultStoreId_fkey"
    FOREIGN KEY ("defaultStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ShoppingItem" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "icon"         TEXT NOT NULL DEFAULT '📦',
    "storeId"      TEXT NOT NULL,
    "assignedToId" TEXT,
    "note"         TEXT,
    "boughtAt"     TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShoppingItem_storeId_idx" ON "ShoppingItem"("storeId");
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Two stores to start; add more from the admin area.
INSERT INTO "Store" ("id", "name", "icon", "sortOrder") VALUES
    ('store_grocery', 'Grocery store', '🛒', 0),
    ('store_costco',  'Costco',        '🏬', 1);

-- A starter catalog so the quick-pick isn't empty on day one. Use counts start
-- at zero; the list re-sorts itself as the household actually shops.
INSERT INTO "GroceryItem" ("id", "name", "icon", "defaultStoreId") VALUES
    (gen_random_uuid()::text, 'Apples', '🍎', 'store_grocery'),
    (gen_random_uuid()::text, 'Bananas', '🍌', 'store_grocery'),
    (gen_random_uuid()::text, 'Oranges', '🍊', 'store_grocery'),
    (gen_random_uuid()::text, 'Strawberries', '🍓', 'store_grocery'),
    (gen_random_uuid()::text, 'Milk', '🥛', 'store_grocery'),
    (gen_random_uuid()::text, 'Eggs', '🥚', 'store_grocery'),
    (gen_random_uuid()::text, 'Butter', '🧈', 'store_grocery'),
    (gen_random_uuid()::text, 'Cheese', '🧀', 'store_grocery'),
    (gen_random_uuid()::text, 'Yogurt', '🥛', 'store_grocery'),
    (gen_random_uuid()::text, 'Bread', '🍞', 'store_grocery'),
    (gen_random_uuid()::text, 'Chicken', '🍗', 'store_grocery'),
    (gen_random_uuid()::text, 'Ground beef', '🥩', 'store_grocery'),
    (gen_random_uuid()::text, 'Rice', '🍚', 'store_grocery'),
    (gen_random_uuid()::text, 'Pasta', '🍝', 'store_grocery'),
    (gen_random_uuid()::text, 'Tomatoes', '🍅', 'store_grocery'),
    (gen_random_uuid()::text, 'Onions', '🧅', 'store_grocery'),
    (gen_random_uuid()::text, 'Potatoes', '🥔', 'store_grocery'),
    (gen_random_uuid()::text, 'Carrots', '🥕', 'store_grocery'),
    (gen_random_uuid()::text, 'Lettuce', '🥬', 'store_grocery'),
    (gen_random_uuid()::text, 'Coffee', '☕', 'store_grocery'),
    (gen_random_uuid()::text, 'Cereal', '🥣', 'store_grocery'),
    (gen_random_uuid()::text, 'Orange juice', '🧃', 'store_grocery'),
    (gen_random_uuid()::text, 'Olive oil', '🫒', 'store_costco'),
    (gen_random_uuid()::text, 'Paper towels', '🧻', 'store_costco'),
    (gen_random_uuid()::text, 'Toilet paper', '🧻', 'store_costco'),
    (gen_random_uuid()::text, 'Dish soap', '🧼', 'store_grocery'),
    (gen_random_uuid()::text, 'Batteries', '🔋', 'store_costco');

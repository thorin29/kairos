-- Idempotency key for offline-created rows. A create retried after its response
-- was lost (server committed, client never saw the id) is recognized by its
-- clientId and returns the existing row instead of inserting a duplicate.
-- Nullable, so every existing row is unaffected; the unique index allows many
-- NULLs and enforces uniqueness only on real client ids. ShoppingItem has no
-- direct user column (groceries are a shared household list), so its key is
-- global; the others are unique per owner.
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "MoneyEntry" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "ShoppingItem" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Book_userId_clientId_key" ON "Book"("userId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "Task_userId_clientId_key" ON "Task"("userId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "MoneyEntry_userId_clientId_key" ON "MoneyEntry"("userId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShoppingItem_clientId_key" ON "ShoppingItem"("clientId");

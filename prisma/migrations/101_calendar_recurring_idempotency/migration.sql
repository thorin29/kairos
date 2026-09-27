-- Extend offline-create idempotency to calendar events and recurring task
-- templates. Same shape as migration 100: a nullable clientId plus a unique
-- index, so existing rows are unaffected and a create retried after a lost
-- response is recognized instead of duplicating. Event has no reliable owner
-- column (family events carry a null userId), so its key is global; a recurring
-- template is unique per owner.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "RecurringTask" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Event_clientId_key" ON "Event"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "RecurringTask_userId_clientId_key" ON "RecurringTask"("userId", "clientId");

-- Custom, admin-managed event types (e.g. "Hockey game", "Medical appointment")
-- with their own colour. Events may point at one; built-in kinds still work.
-- Additive and re-runnable.

CREATE TABLE IF NOT EXISTS "EventType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventType_name_key" ON "EventType"("name");

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "eventTypeId" TEXT;
CREATE INDEX IF NOT EXISTS "Event_eventTypeId_idx" ON "Event"("eventTypeId");

DO $$ BEGIN
    ALTER TABLE "Event" ADD CONSTRAINT "Event_eventTypeId_fkey"
        FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

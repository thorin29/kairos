-- Per-event reminders: minutes-before values the app fires locally (e.g. {15,60}
-- for 15 min and 1 hour before). Empty by default. EventType gains an optional
-- default reminder, pre-filled onto new events of that type. Additive only.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminders" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "defaultReminder" INTEGER;

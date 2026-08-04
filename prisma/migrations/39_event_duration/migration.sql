-- Optional default duration (minutes) for a custom event type, e.g. a hockey
-- practice defaults to 90 minutes when picked in the add-event form.
ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "defaultMinutes" INTEGER;

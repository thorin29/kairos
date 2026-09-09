-- Per-event reminder recipients: the user ids that receive this event's
-- reminders. Empty = nobody. New app events populate it (creator for a personal
-- event, everyone for a family event); the web will toggle it per person.
-- Additive only. Existing events with reminders keep the owner as a recipient
-- so their reminder still fires; family/participant recipients can be re-set.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "reminderUserIds" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "Event"
  SET "reminderUserIds" = ARRAY["userId"]
  WHERE "userId" IS NOT NULL
    AND array_length("reminders", 1) > 0
    AND (array_length("reminderUserIds", 1) IS NULL);

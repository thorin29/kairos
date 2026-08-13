-- Two additive flags:
--  - ExternalCalendar.sportWorkout: a feed whose events auto-log a sport
--    workout on their day for the feed's owner (hockey/game schedules).
--  - Event.cancelled: a tombstone child override that removes a single
--    occurrence from a repeating series without rendering itself.
--
-- Additive and re-runnable: two columns with safe defaults, nothing rewritten.

ALTER TABLE "ExternalCalendar" ADD COLUMN IF NOT EXISTS "sportWorkout" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "cancelled" BOOLEAN NOT NULL DEFAULT false;

-- When on, the feed's default length overrides every event's own end time.
ALTER TABLE "ExternalCalendar" ADD COLUMN "forceDuration" BOOLEAN NOT NULL DEFAULT false;

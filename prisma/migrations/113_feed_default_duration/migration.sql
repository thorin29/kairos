-- Per-feed default event length (minutes) for feed events with no end/duration.
ALTER TABLE "ExternalCalendar" ADD COLUMN "defaultDurationMin" INTEGER;

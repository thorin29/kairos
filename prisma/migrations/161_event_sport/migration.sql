-- Which sport an event type or subscribed calendar is (v0.745). Null = told by
-- the event, type or calendar name; with no sport named it is just "Sport".
ALTER TABLE "EventType" ADD COLUMN "sport" TEXT;
ALTER TABLE "ExternalCalendar" ADD COLUMN "sport" TEXT;

-- Before this release an unnamed sport read as Hockey. Keep that for types and
-- calendars already marked as sport whose name doesn't name another sport.
UPDATE "EventType" SET "sport" = 'Hockey'
WHERE "sportWorkout" = true AND "sport" IS NULL
  AND "name" !~* '(soccer|futsal|basketball|hoops|baseball|softball|lacrosse|volleyball|pickleball|tennis|rugby|wrestling|\mfootball\M)';
UPDATE "ExternalCalendar" SET "sport" = 'Hockey'
WHERE "sportWorkout" = true AND "sport" IS NULL
  AND "name" !~* '(soccer|futsal|basketball|hoops|baseball|softball|lacrosse|volleyball|pickleball|tennis|rugby|wrestling|\mfootball\M)';

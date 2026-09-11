-- A subscribed calendar can be assigned to several people; their names show on its events.
ALTER TABLE "ExternalCalendar" ADD COLUMN IF NOT EXISTS "memberIds" TEXT[] NOT NULL DEFAULT '{}';

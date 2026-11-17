-- A subscribed calendar of work shifts (v0.734): its events take the Work kind.
ALTER TABLE "ExternalCalendar" ADD COLUMN "isWork" BOOLEAN NOT NULL DEFAULT false;

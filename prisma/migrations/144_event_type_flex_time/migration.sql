-- v0.656: a sport event type whose time varies (stick and puck, drop-in):
-- its logged minutes can be changed afterwards.
ALTER TABLE "EventType" ADD COLUMN "sportFlexTime" BOOLEAN NOT NULL DEFAULT false;

-- Game, practice or other for a sport event type (v0.676). Null: told by the
-- event's title (" @ " / " vs " a game; Practice, Stick & Puck, Skate a practice).
ALTER TABLE "EventType" ADD COLUMN "sportKind" TEXT;

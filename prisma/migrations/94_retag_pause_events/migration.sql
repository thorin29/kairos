-- Re-tag every existing pause marker event from OTHER to the new PAUSE kind so
-- past vacations/breaks stop rendering as red "Medical / Dental". Only touches
-- events linked from a Pause row, so real medical/dental events are untouched.
-- Idempotent. Runs after 93 so the PAUSE enum value is already committed.
UPDATE "Event" SET "kind" = 'PAUSE'
WHERE "id" IN (SELECT "eventId" FROM "Pause" WHERE "eventId" IS NOT NULL);

-- Calendar (v0.774): an event's reminders go to everyone on it (owner,
-- people it's shared with, everyone for a family event), and each person can
-- change or mute their own (a "SubscribedReminder" row, now for any event).
-- To change nothing for events that already exist, write down what each
-- person got under the old rule (the event's bell list):

-- People on an event who weren't on its bell list: muted.
WITH ev AS (
  SELECT e."id", e."userId", e."isFamily", e."reminderUserIds"
  FROM "Event" e
  WHERE cardinality(e."reminders") > 0 AND e."externalCalendarId" IS NULL
),
rec AS (
  SELECT ev."id" AS "eventId", ev."userId" AS "uid" FROM ev WHERE ev."userId" IS NOT NULL
  UNION
  SELECT p."eventId", p."userId" FROM "EventParticipant" p JOIN ev ON ev."id" = p."eventId"
  UNION
  SELECT ev."id", u."id" FROM ev JOIN "User" u ON ev."isFamily" AND u."isActive"
)
INSERT INTO "SubscribedReminder" ("id", "eventId", "userId", "minutes")
SELECT 'm175a' || md5(rec."eventId" || ':' || rec."uid"), rec."eventId", rec."uid", '{}'::integer[]
FROM rec JOIN ev ON ev."id" = rec."eventId"
WHERE NOT (rec."uid" = ANY(ev."reminderUserIds"))
ON CONFLICT ("eventId", "userId") DO NOTHING;

-- People on a bell list who aren't on the event: keep their reminders.
WITH ev AS (
  SELECT e."id", e."userId", e."isFamily", e."reminders", e."reminderUserIds"
  FROM "Event" e
  WHERE cardinality(e."reminders") > 0 AND e."externalCalendarId" IS NULL
)
INSERT INTO "SubscribedReminder" ("id", "eventId", "userId", "minutes")
SELECT 'm175b' || md5(ev."id" || ':' || b."uid"), ev."id", b."uid", ev."reminders"
FROM ev CROSS JOIN LATERAL unnest(ev."reminderUserIds") AS b("uid")
WHERE EXISTS (SELECT 1 FROM "User" u WHERE u."id" = b."uid")
  AND NOT ev."isFamily"
  AND b."uid" IS DISTINCT FROM ev."userId"
  AND NOT EXISTS (SELECT 1 FROM "EventParticipant" p WHERE p."eventId" = ev."id" AND p."userId" = b."uid")
ON CONFLICT ("eventId", "userId") DO NOTHING;

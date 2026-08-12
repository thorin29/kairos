-- School: real class membership. A class had one owner plus, for shared
-- classes, EventParticipant rows on its meeting event. ClassMember makes
-- membership first-class (owner included), so any member's work can be filed
-- under the class and — later — every member gets a post-class prompt.
-- Additive and re-runnable; backfills from the existing owner and participants.

CREATE TABLE IF NOT EXISTS "ClassMember" (
    "id"        TEXT NOT NULL,
    "classId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClassMember_classId_userId_key"
    ON "ClassMember"("classId", "userId");
CREATE INDEX IF NOT EXISTS "ClassMember_userId_idx" ON "ClassMember"("userId");

ALTER TABLE "ClassMember" DROP CONSTRAINT IF EXISTS "ClassMember_classId_fkey";
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassMember" DROP CONSTRAINT IF EXISTS "ClassMember_userId_fkey";
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The owner is a member of their own class (id keyed on class+user so a re-run
-- is a no-op; the unique pair is the real guard).
INSERT INTO "ClassMember" ("id", "classId", "userId")
SELECT md5('cm:' || c."id" || ':' || c."userId"), c."id", c."userId"
FROM "SchoolClass" c
ON CONFLICT ("classId", "userId") DO NOTHING;

-- Existing shared students (participants on the class's meeting event) become
-- members too.
INSERT INTO "ClassMember" ("id", "classId", "userId")
SELECT md5('cm:' || c."id" || ':' || ep."userId"), c."id", ep."userId"
FROM "SchoolClass" c
JOIN "EventParticipant" ep ON ep."eventId" = c."eventId"
WHERE c."eventId" IS NOT NULL
ON CONFLICT ("classId", "userId") DO NOTHING;

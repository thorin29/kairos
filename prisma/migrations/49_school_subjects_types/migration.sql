-- School: a reusable Subject pool (like the chore master list) and a ClassType
-- pool (Homeschool, Church, Dual credit…). A class picks a subject for its name
-- and, optionally, a type. Additive and re-runnable: seeds the subject pool from
-- existing class names and free-text subjects, then links classes to them, so
-- nothing that's already there loses its name.

CREATE TABLE IF NOT EXISTS "Subject" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subject_name_key" ON "Subject"("name");

CREATE TABLE IF NOT EXISTS "ClassType" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClassType_name_key" ON "ClassType"("name");

ALTER TABLE "SchoolClass" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "SchoolClass" ADD COLUMN IF NOT EXISTS "classTypeId" TEXT;

ALTER TABLE "SchoolClass" DROP CONSTRAINT IF EXISTS "SchoolClass_subjectId_fkey";
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SchoolClass" DROP CONSTRAINT IF EXISTS "SchoolClass_classTypeId_fkey";
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_classTypeId_fkey"
    FOREIGN KEY ("classTypeId") REFERENCES "ClassType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "SchoolClass_subjectId_idx" ON "SchoolClass"("subjectId");
CREATE INDEX IF NOT EXISTS "SchoolClass_classTypeId_idx" ON "SchoolClass"("classTypeId");

-- Seed the class-type pool with common kinds (id keyed on the name so re-runs
-- can't duplicate; the unique name is the real guard).
INSERT INTO "ClassType" ("id", "name", "sortOrder")
VALUES
  (md5('classtype:Homeschool'),  'Homeschool',  0),
  (md5('classtype:Church'),      'Church',      1),
  (md5('classtype:Dual credit'), 'Dual credit', 2)
ON CONFLICT ("name") DO NOTHING;

-- Backfill the subject pool from existing class names and free-text subjects,
-- so the pool isn't empty on first load. id is keyed on the exact name so a
-- re-run is a no-op; the unique name still guards against duplicates.
INSERT INTO "Subject" ("id", "name", "sortOrder")
SELECT md5('subject:' || src.name), src.name, 0
FROM (
  SELECT DISTINCT btrim("name") AS name
  FROM "SchoolClass"
  WHERE btrim(coalesce("name", '')) <> ''
  UNION
  SELECT DISTINCT btrim("subject") AS name
  FROM "SchoolWork"
  WHERE btrim(coalesce("subject", '')) <> ''
) AS src
ON CONFLICT ("name") DO NOTHING;

-- Link existing classes to their matching subject by name (case-insensitive).
UPDATE "SchoolClass" c
SET "subjectId" = s."id"
FROM "Subject" s
WHERE c."subjectId" IS NULL
  AND btrim(coalesce(c."name", '')) <> ''
  AND lower(btrim(c."name")) = lower(s."name");

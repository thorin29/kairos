-- Base subjects become first-class colour groups. Each subject hangs under one.
CREATE TABLE "BaseSubject" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BaseSubject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BaseSubject_name_key" ON "BaseSubject"("name");

ALTER TABLE "Subject" ADD COLUMN "baseSubjectId" TEXT;
ALTER TABLE "Subject"
  ADD CONSTRAINT "Subject_baseSubjectId_fkey"
  FOREIGN KEY ("baseSubjectId") REFERENCES "BaseSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 1) A base subject for each existing base group (Math, Science, …).
INSERT INTO "BaseSubject" ("id", "name", "sortOrder")
SELECT md5(random()::text || clock_timestamp()::text), g."baseSubject", 0
FROM (SELECT DISTINCT "baseSubject" FROM "Subject" WHERE "baseSubject" IS NOT NULL) g
ON CONFLICT ("name") DO NOTHING;

-- 2) A base subject for every subject with no base (each becomes its own header),
--    skipping any whose name already matches a base group.
INSERT INTO "BaseSubject" ("id", "name", "sortOrder")
SELECT md5(random()::text || clock_timestamp()::text), s."name", 0
FROM "Subject" s
WHERE s."baseSubject" IS NULL
ON CONFLICT ("name") DO NOTHING;

-- 3) Link every subject to its base (its explicit base, else its own-name base).
UPDATE "Subject" s
SET "baseSubjectId" = b."id"
FROM "BaseSubject" b
WHERE b."name" = COALESCE(s."baseSubject", s."name");

-- 4) Carry any per-subject colour override onto its base (best effort seed).
UPDATE "BaseSubject" b
SET "color" = s."color"
FROM "Subject" s
WHERE s."baseSubjectId" = b."id" AND s."color" IS NOT NULL AND b."color" IS NULL;

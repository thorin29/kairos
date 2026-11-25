-- v0.792: a generated Bible or workout task exists once per person per day.
-- Two requests generating the same days at the same moment could each create
-- the row (seen at 00:02, 10 ms apart). Keep one copy — a done one over a
-- pending one, then the oldest — and let the index refuse the rest; the
-- generators' createMany(skipDuplicates) then skips them quietly.
DELETE FROM "Task" t
USING (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "userId", "generatedFrom", "dueDate"
           ORDER BY ("status" = 'PENDING') ASC, "createdAt" ASC, "id" ASC
         ) AS rn
  FROM "Task"
  WHERE "generatedFrom" LIKE 'plan:%' OR "generatedFrom" LIKE 'workout:%'
) d
WHERE t."id" = d."id" AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Task_generated_once"
  ON "Task" ("userId", "generatedFrom", "dueDate")
  WHERE "generatedFrom" LIKE 'plan:%' OR "generatedFrom" LIKE 'workout:%';

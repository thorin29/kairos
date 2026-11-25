-- v0.793: recurring tasks ("rtask:") are generated the same way as Bible and
-- workout tasks and could double the same way. Keep one copy of each (a done
-- one over a pending one, then the oldest) and widen 181's index to them.
DELETE FROM "Task" t
USING (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "userId", "generatedFrom", "dueDate"
           ORDER BY ("status" = 'PENDING') ASC, "createdAt" ASC, "id" ASC
         ) AS rn
  FROM "Task"
  WHERE "generatedFrom" LIKE 'rtask:%'
) d
WHERE t."id" = d."id" AND d.rn > 1;

DROP INDEX IF EXISTS "Task_generated_once";

CREATE UNIQUE INDEX "Task_generated_once"
  ON "Task" ("userId", "generatedFrom", "dueDate")
  WHERE "generatedFrom" LIKE 'plan:%'
     OR "generatedFrom" LIKE 'workout:%'
     OR "generatedFrom" LIKE 'rtask:%';

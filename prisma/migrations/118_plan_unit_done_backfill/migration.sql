-- Completed schoolwork never marked its plan unit done.
--
-- `ClassPlanUnit.done` is a stored flag. Only the admin school-work screen set
-- it; completing the same work from a person's card (web or phone) updated the
-- Task and nothing else, so the plan review showed finished lessons as overdue
-- forever. The code now syncs on every completion path — this repairs the rows
-- that were written before it did.
--
-- Recoverable because the Task rows hold the answer: a unit whose work's task
-- is COMPLETE was done, whatever the flag says.
--
-- One direction only. It never clears `done`, because a unit can be marked
-- complete by an admin with no task behind it at all (work skipped at upload
-- time), and clearing those would re-open work that was finished off the books.
UPDATE "ClassPlanUnit" u
SET "done" = true
FROM "SchoolWork" sw
JOIN "Task" t ON t."id" = sw."taskId"
WHERE u."workId" = sw."id"
  AND t."status" = 'COMPLETE'
  AND u."done" = false;

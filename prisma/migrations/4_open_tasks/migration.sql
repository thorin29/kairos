-- Chores can be released back to the household and claimed by someone else.
ALTER TABLE "Task" ADD COLUMN "isOpen" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Task_isOpen_dueDate_idx" ON "Task"("isOpen", "dueDate");

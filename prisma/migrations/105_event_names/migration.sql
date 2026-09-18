-- Remembered calendar event names for the new-event name picker. Grows as
-- events are created; admins normalize spelling/casing on /admin/event-names.
CREATE TABLE "EventName" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventName_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventName_name_key" ON "EventName"("name");

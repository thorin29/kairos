-- Links every piece of a logically-single recurring series that has been split
-- by a "this and future" edit, so deleting the whole series removes all pieces.
ALTER TABLE "Event" ADD COLUMN "seriesId" TEXT;
CREATE INDEX "Event_seriesId_idx" ON "Event"("seriesId");

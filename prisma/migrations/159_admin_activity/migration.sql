-- Who changed what (v0.733): every change a parent makes, kept 12 months.
CREATE TABLE "AdminActivity" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "recordId" TEXT,
    "label" TEXT,
    "subjectId" TEXT,
    "changes" JSONB,
    "count" INTEGER,
    CONSTRAINT "AdminActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminActivity_at_idx" ON "AdminActivity"("at");

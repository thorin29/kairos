-- Day extras (v0.667): mobility, stretching or an isometric workout added to
-- one day only from "+ Additional".
CREATE TABLE "DayExtra" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DayExtra_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DayExtra_userId_date_idx" ON "DayExtra"("userId", "date");
ALTER TABLE "DayExtra" ADD CONSTRAINT "DayExtra_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

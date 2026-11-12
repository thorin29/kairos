-- Family WOD (v0.679): one shared conditioning workout on a day a parent
-- picks, who's in it (assigned or joined), and suggestions for parents to
-- approve. Results are the HIIT sessions logged under the workout's name.
CREATE TABLE "FamilyWod" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hiitWorkoutId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyWod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FamilyWod_date_key" ON "FamilyWod"("date");
ALTER TABLE "FamilyWod" ADD CONSTRAINT "FamilyWod_hiitWorkoutId_fkey" FOREIGN KEY ("hiitWorkoutId") REFERENCES "HiitWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FamilyWodMember" (
    "familyWodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "how" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyWodMember_pkey" PRIMARY KEY ("familyWodId", "userId")
);
CREATE INDEX "FamilyWodMember_userId_idx" ON "FamilyWodMember"("userId");
ALTER TABLE "FamilyWodMember" ADD CONSTRAINT "FamilyWodMember_familyWodId_fkey" FOREIGN KEY ("familyWodId") REFERENCES "FamilyWod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyWodMember" ADD CONSTRAINT "FamilyWodMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FamilyWodSuggestion" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hiitWorkoutId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyWodSuggestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FamilyWodSuggestion_status_date_idx" ON "FamilyWodSuggestion"("status", "date");
ALTER TABLE "FamilyWodSuggestion" ADD CONSTRAINT "FamilyWodSuggestion_hiitWorkoutId_fkey" FOREIGN KEY ("hiitWorkoutId") REFERENCES "HiitWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyWodSuggestion" ADD CONSTRAINT "FamilyWodSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

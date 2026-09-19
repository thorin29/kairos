-- Who a shared (up-for-grabs) chore is available for. No rows for a chore means
-- it's available to everyone; a non-empty set is the curated eligible list.
CREATE TABLE "PoolEligibility" (
    "choreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "PoolEligibility_pkey" PRIMARY KEY ("choreId", "userId")
);

CREATE INDEX "PoolEligibility_userId_idx" ON "PoolEligibility"("userId");

ALTER TABLE "PoolEligibility" ADD CONSTRAINT "PoolEligibility_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PoolEligibility" ADD CONSTRAINT "PoolEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

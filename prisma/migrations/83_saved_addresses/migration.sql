DO $$ BEGIN
  CREATE TYPE "AddressStatus" AS ENUM ('APPROVED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "SavedAddress" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "status" "AddressStatus" NOT NULL DEFAULT 'APPROVED',
  "submittedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedAddress_status_idx" ON "SavedAddress"("status");

DO $$ BEGIN
  ALTER TABLE "SavedAddress" ADD CONSTRAINT "SavedAddress_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Places notifications and push (v0.759).

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "pushToken" TEXT;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "pushTokenAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PlacesNotifyRule" (
    "id" TEXT NOT NULL,
    "tellUserIds" JSONB NOT NULL,
    "aboutUserId" TEXT,
    "placeNameId" TEXT,
    "savedAddressId" TEXT,
    "onArrive" BOOLEAN NOT NULL DEFAULT true,
    "onLeave" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlacesNotifyRule_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PlacesNotifyRule" ADD CONSTRAINT "PlacesNotifyRule_aboutUserId_fkey"
    FOREIGN KEY ("aboutUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlacesNotifyRule" ADD CONSTRAINT "PlacesNotifyRule_placeNameId_fkey"
    FOREIGN KEY ("placeNameId") REFERENCES "PlaceName"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlacesNotifyRule" ADD CONSTRAINT "PlacesNotifyRule_savedAddressId_fkey"
    FOREIGN KEY ("savedAddressId") REFERENCES "SavedAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PlacesAlertState" (
    "userId" TEXT NOT NULL,
    "placeKey" TEXT NOT NULL,
    "inside" BOOLEAN NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    CONSTRAINT "PlacesAlertState_pkey" PRIMARY KEY ("userId", "placeKey")
);

CREATE TABLE IF NOT EXISTS "PushMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    CONSTRAINT "PushMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PushMessage_userId_deliveredAt_idx" ON "PushMessage"("userId", "deliveredAt");

DO $$ BEGIN
  ALTER TABLE "PushMessage" ADD CONSTRAINT "PushMessage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

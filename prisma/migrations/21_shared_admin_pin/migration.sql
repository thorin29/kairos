-- Move from a per-user admin PIN to a single shared admin PIN stored as an
-- AppSetting ("adminPinHash"). To avoid anyone getting locked out (or admin
-- falling open) on upgrade, copy the first active admin's existing PIN hash
-- into the shared setting. Per-user pinHash columns are left in place, unused.
-- Idempotent: ON CONFLICT keeps an already-set shared PIN untouched.
INSERT INTO "AppSetting" ("key", "value", "updatedAt")
SELECT 'adminPinHash', "pinHash", now()
FROM "User"
WHERE "role" = 'ADMIN' AND "pinHash" IS NOT NULL AND "isActive" = true
ORDER BY "createdAt" ASC
LIMIT 1
ON CONFLICT ("key") DO NOTHING;

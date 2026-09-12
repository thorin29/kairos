-- A household pause (vacation/break) generates an all-day marker event. It used
-- the OTHER kind, which is now styled "Medical / Dental" (red) — so vacations
-- were showing as medical events. Give pauses their own kind. ADD VALUE IF NOT
-- EXISTS is idempotent and safe here (the value is not used in this migration;
-- it is used in the next one, 94, after this commits).
ALTER TYPE "EventKind" ADD VALUE IF NOT EXISTS 'PAUSE';

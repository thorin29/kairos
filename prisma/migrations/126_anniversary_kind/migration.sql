-- Anniversary: a yearly all-day occasion like Birthday (v0.591.0). Adding an
-- enum value is idempotent with IF NOT EXISTS.
ALTER TYPE "EventKind" ADD VALUE IF NOT EXISTS 'ANNIVERSARY';

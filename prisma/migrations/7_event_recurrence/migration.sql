-- Birthdays for people who aren't household members (grandparents, friends)
-- are ordinary annual events rather than profile fields.
ALTER TYPE "EventKind" ADD VALUE IF NOT EXISTS 'BIRTHDAY';

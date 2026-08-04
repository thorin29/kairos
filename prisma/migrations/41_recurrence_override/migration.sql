-- Editing a single occurrence of a repeating event detaches a child event
-- (recurrenceId -> parent) and records the original occurrence date it stands
-- in for, so the parent series skips that date. The child's own start may be
-- moved to a different day/time.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "recurrenceDate" DATE;

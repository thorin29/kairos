-- Relabel the "Appointment" event kind to the more generic "Event" (display
-- only; the APPOINTMENT enum value is unchanged). Bring any saved-address
-- categories that used the old label along. Idempotent.
UPDATE "SavedAddress" SET "category" = 'Event' WHERE "category" = 'Appointment';

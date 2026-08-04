-- Per-event control of the calendar day-column shading. Defaults to on so
-- existing all-day events keep tinting; a shared birthday or an ordinary
-- all-day event can be switched off individually.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "shadeDay" BOOLEAN NOT NULL DEFAULT true;

-- Household members' birthdays are generated from the profile, so their toggle
-- lives on the person rather than an event row.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shadeBirthday" BOOLEAN NOT NULL DEFAULT true;

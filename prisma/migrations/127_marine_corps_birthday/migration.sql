-- Marine Corps Birthday (Nov 10) joins the holiday list (v0.592.0), on by
-- default. A household that has already saved its holiday choices keeps them,
-- so the new holiday is added to that saved list once; one that never saved
-- them gets it from the code defaults. It is never added to the no-school list.
-- Idempotent (only appends when missing); a saved value that isn't a JSON array
-- is left alone, as the app already falls back to defaults for it.
DO $$
BEGIN
  UPDATE "AppSetting"
  SET "value" = (("value")::jsonb || '["marine_corps_birthday"]'::jsonb)::text
  WHERE "key" = 'holidays.enabled'
    AND jsonb_typeof(("value")::jsonb) = 'array'
    AND NOT (("value")::jsonb ? 'marine_corps_birthday');
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Family map (v0.767): business search reaches further. Forget cached
-- street-address-only answers once so those spots are asked again.

DELETE FROM "PlaceLookup" WHERE "source" IN ('geocode', 'none');

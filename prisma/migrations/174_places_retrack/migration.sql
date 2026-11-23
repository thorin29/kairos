-- Family map (v0.772): road matching checks each stretch of a drive on its
-- own and allows for fuzzy fixes. Drives drawn as recorded are worked out again.

DELETE FROM "SnappedPath" WHERE "snapped" = false;

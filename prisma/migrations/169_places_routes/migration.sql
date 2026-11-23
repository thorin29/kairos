-- Places (v0.761): sparse drives now use the Routes API. Clear cached road
-- tracks once so drives drawn straight before are worked out again when viewed.

DELETE FROM "SnappedPath";

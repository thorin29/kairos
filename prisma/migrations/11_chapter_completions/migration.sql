-- Track reading progress by chapter, not just by whole book, so a book the
-- household is part way through — Psalms, say — can be ticked off as far as
-- they've actually read. Whole-book marks become a full set of chapter rows.
--
-- This is the manual baseline only: what was read before, or outside, this
-- installation's plan. The published plan's own coverage is still counted
-- live from its scheduled days, independently, and neither depends on whether
-- any individual ticked their daily box.

CREATE TABLE "ChapterCompletion" (
    "bookName"    TEXT NOT NULL,
    "chapter"     INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChapterCompletion_pkey" PRIMARY KEY ("bookName", "chapter")
);

-- Expand any existing whole-book completions into their chapters so nothing
-- marked under the previous version is lost.
INSERT INTO "ChapterCompletion" ("bookName", "chapter")
SELECT bc."bookName", g.chapter
FROM "BookCompletion" bc
JOIN (VALUES
    ('Genesis', 50),
    ('Exodus', 40),
    ('Leviticus', 27),
    ('Numbers', 36),
    ('Deuteronomy', 34),
    ('Joshua', 24),
    ('Judges', 21),
    ('Ruth', 4),
    ('1 Samuel', 31),
    ('2 Samuel', 24),
    ('1 Kings', 22),
    ('2 Kings', 25),
    ('1 Chronicles', 29),
    ('2 Chronicles', 36),
    ('Ezra', 10),
    ('Nehemiah', 13),
    ('Esther', 10),
    ('Job', 42),
    ('Psalms', 150),
    ('Proverbs', 31),
    ('Ecclesiastes', 12),
    ('Song of Solomon', 8),
    ('Isaiah', 66),
    ('Jeremiah', 52),
    ('Lamentations', 5),
    ('Ezekiel', 48),
    ('Daniel', 12),
    ('Hosea', 14),
    ('Joel', 3),
    ('Amos', 9),
    ('Obadiah', 1),
    ('Jonah', 4),
    ('Micah', 7),
    ('Nahum', 3),
    ('Habakkuk', 3),
    ('Zephaniah', 3),
    ('Haggai', 2),
    ('Zechariah', 14),
    ('Malachi', 4),
    ('Matthew', 28),
    ('Mark', 16),
    ('Luke', 24),
    ('John', 21),
    ('Acts', 28),
    ('Romans', 16),
    ('1 Corinthians', 16),
    ('2 Corinthians', 13),
    ('Galatians', 6),
    ('Ephesians', 6),
    ('Philippians', 4),
    ('Colossians', 4),
    ('1 Thessalonians', 5),
    ('2 Thessalonians', 3),
    ('1 Timothy', 6),
    ('2 Timothy', 4),
    ('Titus', 3),
    ('Philemon', 1),
    ('Hebrews', 13),
    ('James', 5),
    ('1 Peter', 5),
    ('2 Peter', 3),
    ('1 John', 5),
    ('2 John', 1),
    ('3 John', 1),
    ('Jude', 1),
    ('Revelation', 22)
) AS counts(name, n) ON counts.name = bc."bookName"
CROSS JOIN LATERAL generate_series(1, counts.n) AS g(chapter)
ON CONFLICT DO NOTHING;

DROP TABLE "BookCompletion";

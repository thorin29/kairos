-- Bodyweight movements log reps (v0.629.0). A pool movement tagged with a
-- library bodyweight movement (push-ups, pull-ups, dips, sit-ups…) and with no
-- "Logs as" of its own takes REPS; plan entries for those, and for movements
-- outside Weights placed in a weights plan (pull-ups kept under HIIT), stop
-- asking for a weight. A weighted version is its own movement. Idempotent.
UPDATE "PoolExercise" SET "metric" = 'REPS'
WHERE "metric" IS NULL AND "category" = 'WEIGHTS' AND "libraryKey" IN (
  'trx-row',
  'trx-y-raise',
  'trx-push-up',
  'trx-chest-fly',
  'trx-biceps-curl',
  'trx-triceps-extension',
  'trx-assisted-pistol-squat',
  'trx-hamstring-curl',
  'trx-fallout',
  'trx-pike',
  'chest-pass',
  'rotational-throw',
  'sit-up-throw',
  'rotational-slam',
  'scapular-pull-up',
  'negative-pull-up',
  'pull-up',
  'chin-up',
  'hanging-knee-raise',
  'hanging-leg-raise',
  'toes-to-bar',
  'back-extension',
  'hip-extension',
  'side-bend',
  'incline-push-up',
  'push-up',
  'decline-push-up',
  'diamond-push-up',
  'bench-dip',
  'dip',
  'pike-push-up',
  'air-squat',
  'jump-squat',
  'bodyweight-lunge',
  'box-step-up',
  'glute-bridge',
  'single-leg-glute-bridge',
  'superman',
  'sit-up',
  'russian-twist',
  'dead-bug',
  'bird-dog'
);
UPDATE "PlannedExercise" pe SET "metric" = 'REPS'
FROM "PoolExercise" p
WHERE pe."poolExerciseId" = p."id" AND pe."metric" = 'WEIGHT'
  AND (p."metric" = 'REPS' OR (p."category" <> 'WEIGHTS' AND p."metric" IS DISTINCT FROM 'DURATION'));

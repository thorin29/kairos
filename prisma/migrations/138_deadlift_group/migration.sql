-- Deadlift as its own muscle group (v0.619.0): deadlifts are more than core
-- work, and filing them under Core or Legs mislabelled the charts and the body
-- map. The movements and plans move in 139 (a new enum value can't be used in
-- the transaction that adds it). Idempotent.
ALTER TYPE "MuscleGroup" ADD VALUE IF NOT EXISTS 'DEADLIFT';

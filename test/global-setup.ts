import { execSync } from "node:child_process";

/**
 * Build the test schema straight from schema.prisma via `prisma db push` — the
 * authoritative, complete definition the generated client and the cores are
 * written against.
 *
 * We deliberately do NOT replay the migration files: their historical order
 * alters some tables before creating them (e.g. UserCalendarPref is altered in
 * migration 10 but created in 72), so they aren't a clean from-scratch build.
 * prisma.config.ts supplies the connection from DATABASE_URL, exactly as
 * production's `prisma migrate deploy` step does. --force-reset gives every run
 * a clean schema; per-test row cleanup is handled by resetDb().
 */
export default function setup(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must point at a disposable test Postgres for the idempotency tests.");
  }
  execSync("npx prisma db push --skip-generate --force-reset --accept-data-loss", {
    stdio: "inherit",
    env: process.env,
  });
}

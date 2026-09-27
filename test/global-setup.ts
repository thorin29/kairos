import { Client } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MIGRATIONS } from "@/lib/version";

/**
 * Build the test schema the same way production does: replay the project's own
 * migration SQL, in the canonical MIGRATIONS order, against a throwaway Postgres.
 * No prisma-CLI url config needed (the datasource has none — production applies
 * these via its own runner), and it exercises the exact DDL that ships.
 */
export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must point at a disposable test Postgres for the idempotency tests.");
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  const dir = fileURLToPath(new URL("../prisma/migrations", import.meta.url));
  for (const name of MIGRATIONS) {
    const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    await client.query(sql);
  }
  await client.end();
}

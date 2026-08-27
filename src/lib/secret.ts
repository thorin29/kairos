import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * One HMAC secret for every signed cookie the app issues (admin unlock and
 * personal sessions alike). Generated on first use and kept in `AppSetting`,
 * so it survives restarts without living in the environment, and a fresh
 * install mints its own. Both session modules read the same key, so a cookie
 * signed by one verifies in the other.
 */
const SECRET_KEY = "sessionSecret";

export async function appSecret(): Promise<string> {
  // An explicit env secret takes precedence so that edge middleware (which
  // can't reach the database) can verify the same cookies the app signs. Set
  // SESSION_SECRET to a long random value for a public/gated deployment. With
  // it unset, we fall back to the DB-minted secret, unchanged for LAN installs.
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 16) return env;

  const existing = await prisma.appSetting.findUnique({
    where: { key: SECRET_KEY },
  });
  if (existing) return existing.value;

  const row = await prisma.appSetting.upsert({
    where: { key: SECRET_KEY },
    update: {},
    create: { key: SECRET_KEY, value: randomBytes(32).toString("hex") },
  });
  return row.value;
}

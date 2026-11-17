// Throws at build time if a client component ever imports this file, even
// indirectly. Without it the failure surfaces as webpack being unable to
// resolve Node's net and tls modules, which points nowhere useful.
import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { activityTracked } from "@/lib/activity-model";

// Prisma 7 requires an explicit driver adapter. Connection pooling is now
// handled by node-postgres rather than Prisma, and pg ships with no
// connection timeout at all, so the limits are set explicitly here.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

// Next dev reloads modules on every edit; without this the process
// accumulates pools until Postgres refuses new clients.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

/**
 * The client everything uses (v0.733): the same, plus the Activity log. A
 * write to a followed record (activity-model.ts) made by a parent
 * (activity-context.ts) is noted after it succeeds, with the row as it was
 * before an update or delete. Everything else passes straight through.
 */
export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!activityTracked(model, operation)) return query(args);
        const { activityActor } = await import("@/lib/activity-context");
        const actor = await activityActor();
        if (!actor) return query(args);
        const { activityBefore, recordActivity } = await import("@/lib/activity");
        const db = base as unknown as Record<string, unknown>;
        const before = await activityBefore(db, model, operation, args as { where?: unknown });
        const result = await query(args);
        await recordActivity(db, actor, { model, operation, args, before, result });
        return result;
      },
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

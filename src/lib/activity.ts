import "server-only";
import { ACTIVITY_AREAS } from "@/lib/activity-model";

/**
 * Recording a parent's change for the Activity log (v0.733). prisma.ts calls
 * these around each followed write (activity-model.ts) when activityActor()
 * names a parent: `before` reads the row first, `record` writes one small row
 * with only what changed. Never throws into the write it follows.
 */

type Db = {
  [model: string]: unknown;
};
type Row = Record<string, unknown>;
type Actor = { id: string; name: string };

const KEEP_DAYS = 365;
/** Fields that change on every write, or only order things. */
const IGNORE = new Set(["id", "createdAt", "updatedAt", "sortOrder", "credentialVersion", "lastSeenAt", "lastUsedAt"]);
/** Never written to the log, even as "changed". */
const SECRET = /hash|password|secret|token|pin$/i;
/** Settings the app keeps for itself (one-time fixes, caches). */
const OWN_SETTING = /settled|cache|seen|last|version|migrat/i;

const delegate = (db: Db, model: string) =>
  db[model.charAt(0).toLowerCase() + model.slice(1)] as {
    findUnique: (a: unknown) => Promise<Row | null>;
  };

/** The row as it stands, for an update, upsert or delete of one row. */
export async function activityBefore(db: Db, model: string, operation: string, args: { where?: unknown }): Promise<Row | null> {
  if (!["update", "upsert", "delete"].includes(operation) || !args?.where) return null;
  try {
    return await delegate(db, model).findUnique({ where: args.where });
  } catch {
    return null;
  }
}

const labelOf = (r: Row | null) => {
  if (!r) return null;
  for (const k of ["title", "name", "displayName", "label", "key"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
  }
  return null;
};

function show(v: unknown): string | number | boolean | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ");
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 79)}…` : s;
}

function diff(before: Row, after: Row, model: string): { field: string; before: unknown; after: unknown }[] {
  const out: { field: string; before: unknown; after: unknown }[] = [];
  const secretValue = model === "AppSetting" && SECRET.test(String(after.key ?? before.key ?? ""));
  for (const field of Object.keys(after)) {
    if (IGNORE.has(field)) continue;
    const a = after[field];
    const b = before[field];
    if (a !== null && typeof a === "object" && !(a instanceof Date) && !Array.isArray(a) && "constructor" in a && a.constructor?.name === "Decimal") {
      if (String(a) === String(b)) continue;
    }
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (SECRET.test(field) || (secretValue && field === "value")) {
      out.push({ field, before: "•••", after: "•••" });
      continue;
    }
    out.push({ field, before: show(b), after: show(a) });
  }
  return out.slice(0, 12);
}

let prunedOn = "";

/** Write the log row; prune rows past 12 months once a day. */
export async function recordActivity(
  db: Db,
  actor: Actor,
  w: { model: string; operation: string; args: unknown; before: Row | null; result: unknown },
): Promise<void> {
  try {
    const { model, operation } = w;
    const many = operation.endsWith("Many") || operation.endsWith("ManyAndReturn");
    const after = !many && w.result && typeof w.result === "object" ? (w.result as Row) : null;
    const row = after ?? w.before;

    // Tasks: only ones a parent made or changed by hand for someone else.
    if (model === "Task") {
      if (many) return;
      if (row?.generatedFrom) return;
      if (row?.userId === actor.id) return;
    }
    if (model === "AppSetting" && row && OWN_SETTING.test(String(row.key ?? ""))) return;

    let action: "CREATE" | "UPDATE" | "DELETE";
    let changes: { field: string; before: unknown; after: unknown }[] | null = null;
    let count: number | null = null;
    if (operation.startsWith("create")) action = "CREATE";
    else if (operation.startsWith("delete")) action = "DELETE";
    else if (operation === "upsert") action = w.before ? "UPDATE" : "CREATE";
    else action = "UPDATE";
    if (many) {
      const n = Array.isArray(w.result) ? w.result.length : Number((w.result as { count?: number } | null)?.count ?? 0);
      if (!n) return;
      count = n;
    } else if (action === "UPDATE") {
      if (!w.before || !after) return;
      changes = diff(w.before, after, model);
      if (changes.length === 0) return;
    }
    const subject = typeof row?.userId === "string" && row.userId !== actor.id ? row.userId : null;
    const log = db.adminActivity as { create: (a: unknown) => Promise<unknown>; deleteMany: (a: unknown) => Promise<unknown> };
    await log.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        area: ACTIVITY_AREAS[model] ?? model,
        action,
        model,
        recordId: typeof row?.id === "string" ? row.id : null,
        label: model === "AppSetting" ? (labelOf(row) ?? null) : labelOf(row),
        subjectId: subject,
        ...(changes ? { changes } : {}),
        ...(count != null ? { count } : {}),
      },
    });
    const today = new Date().toISOString().slice(0, 10);
    if (prunedOn !== today) {
      prunedOn = today;
      await log.deleteMany({ where: { at: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
    }
  } catch {
    // The log is a convenience: a failed write here never undoes the change.
  }
}

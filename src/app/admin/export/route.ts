import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { setSetting } from "@/lib/settings";
import { APP_VERSION } from "@/lib/version";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Columns never exported: sign-in secrets, and a calendar feed's private link. */
const DROP_COLUMNS = /^(passwordHash|pinHash|tokenHash)$|hash$|secret|password/i;
const DROP_TABLE_COLUMNS: Record<string, string[]> = { ExternalCalendar: ["url"] };
/** Settings never exported (the admin PIN, the session key, mail passwords). */
const SECRET_SETTING = /hash|secret|pass|token|key$|smtp/i;
/** Caches, not data. */
const SKIP_TABLES = new Set(["_prisma_migrations", "WeatherCache"]);

/**
 * Everything, as one JSON file (v0.733), from Admin → About: every table's
 * rows, without passwords, PINs, device tokens, secret settings or private
 * calendar links. Admin only.
 */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unlock admin first." }, { status: 403 });
  const tables = (await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  )).map((t) => t.table_name).filter((t) => !SKIP_TABLES.has(t));
  const out: Record<string, unknown[]> = {};
  for (const t of tables) {
    const res = await prisma.$queryRawUnsafe<{ rows: Record<string, unknown>[] | null }[]>(
      `SELECT json_agg(x) AS rows FROM "${t.replace(/"/g, "")}" x`,
    );
    let rows = res[0]?.rows ?? [];
    const drop = DROP_TABLE_COLUMNS[t] ?? [];
    rows = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !DROP_COLUMNS.test(k) && !drop.includes(k))));
    if (t === "AppSetting") rows = rows.filter((r) => !SECRET_SETTING.test(String(r.key ?? "")));
    out[t] = rows;
  }
  await setSetting("export.lastAt", new Date().toISOString());
  const body = JSON.stringify({ app: "kairos", version: APP_VERSION, exportedAt: new Date().toISOString(), tables: out }, null, 1);
  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="kairos-export-${todayISO()}.json"`,
      "cache-control": "no-store",
    },
  });
}

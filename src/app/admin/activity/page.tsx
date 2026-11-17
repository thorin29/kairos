import Link from "next/link";
import { AdminBack } from "@/components/admin-back";
import { Avatar } from "@/components/avatar";
import { prisma } from "@/lib/prisma";
import { todayISO, addDays, formatLong, householdTz } from "@/lib/dates";
import { ACTIVITY_AREAS, ACTIVITY_NOUNS } from "@/lib/activity-model";

export const dynamic = "force-dynamic";

const PAGE = 100;
const SELECT = "h-10 rounded-lg border border-hairline bg-surface px-3 text-sm";

type Entry = {
  id: string;
  at: Date;
  actorId: string | null;
  actorName: string;
  area: string;
  action: string;
  model: string;
  label: string | null;
  subjectId: string | null;
  changes: { field: string; before: unknown; after: unknown }[] | null;
  count: number | null;
};

/** "effort" from "effortLevel"; "due date" from "dueDate". */
const fieldName = (f: string) => f.replace(/Id$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const val = (v: unknown) => (v == null || v === "" ? "—" : String(v));

function sentence(e: Entry, names: Map<string, string>): { lead: string; label: string | null; tail: string } {
  const noun = ACTIVITY_NOUNS[e.model] ?? e.model;
  const forWhom = e.subjectId && names.get(e.subjectId) ? ` for ${names.get(e.subjectId)}` : "";
  if (e.count != null) {
    const verb = e.action === "CREATE" ? "Added" : e.action === "DELETE" ? "Deleted" : "Changed";
    return { lead: `${verb} ${e.count} ${noun}${e.count === 1 ? "" : "s"}`, label: null, tail: forWhom };
  }
  if (e.action === "CREATE") return { lead: `Added ${noun}`, label: e.label, tail: forWhom };
  if (e.action === "DELETE") return { lead: `Deleted ${noun}`, label: e.label, tail: forWhom };
  const c = e.changes ?? [];
  const first = c[0];
  const what =
    c.length === 1 && first
      ? `: ${fieldName(first.field)} ${val(first.before)} → ${val(first.after)}`
      : c.length > 1
        ? `: ${c.length} changes`
        : "";
  return { lead: `Changed ${noun}`, label: e.label, tail: `${forWhom}${what}` };
}

const time = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: householdTz() });
const dayOf = (d: Date) => todayISO(d);

/**
 * Activity (v0.733): every change a parent made, newest first, by day. Filter
 * by person and area, or search; Show opens what changed. Kept 12 months.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const who = typeof sp.who === "string" ? sp.who : "";
  const area = typeof sp.area === "string" ? sp.area : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const before = typeof sp.before === "string" && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : null;

  const [rows, people] = await Promise.all([
    prisma.adminActivity.findMany({
      where: {
        ...(who ? { actorId: who } : {}),
        ...(area ? { area } : {}),
        ...(q ? { label: { contains: q, mode: "insensitive" as const } } : {}),
        ...(before ? { at: { lt: before } } : {}),
      },
      orderBy: { at: "desc" },
      take: PAGE + 1,
    }) as unknown as Promise<Entry[]>,
    prisma.user.findMany({
      select: { id: true, name: true, displayName: true, color: true, avatarPath: true, avatarPosition: true, kind: true },
      orderBy: { sortOrder: "asc" },
    }) as unknown as Promise<
      { id: string; name: string; displayName: string | null; color: string; avatarPath: string | null; avatarPosition: string; kind: string }[]
    >,
  ]);
  const more = rows.length > PAGE;
  const shown = rows.slice(0, PAGE);
  const names = new Map(people.map((p) => [p.id, p.displayName ?? p.name]));
  const byId = new Map(people.map((p) => [p.id, p]));
  const today = todayISO();
  const groups: { day: string; items: Entry[] }[] = [];
  for (const e of shown) {
    const d = dayOf(e.at);
    const g = groups.at(-1);
    if (g && g.day === d) g.items.push(e);
    else groups.push({ day: d, items: [e] });
  }
  const areas = [...new Set(Object.values(ACTIVITY_AREAS))].sort();
  const params = (extra: Record<string, string>) =>
    `?${new URLSearchParams({ ...(who ? { who } : {}), ...(area ? { area } : {}), ...(q ? { q } : {}), ...extra }).toString()}`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <AdminBack />
      <header className="mb-6 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-2 text-muted">Who changed what, and when</p>
      </header>

      <form className="mb-5 flex flex-wrap gap-2" action="/admin/activity">
        <label className="sr-only" htmlFor="who">
          Person
        </label>
        <select id="who" name="who" defaultValue={who} className={SELECT}>
          <option value="">Everyone</option>
          {people
            .filter((p) => p.kind === "PARENT")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName ?? p.name}
              </option>
            ))}
        </select>
        <label className="sr-only" htmlFor="area">
          Area
        </label>
        <select id="area" name="area" defaultValue={area} className={SELECT}>
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="q">
          Search
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Search" className={`${SELECT} min-w-48 flex-1`} />
        <button type="submit" className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent">
          Show
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-6 text-center text-sm text-muted">Nothing yet.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.day} className="rounded-2xl border border-hairline bg-surface px-4 py-2">
              <p className="py-2 text-xs font-semibold uppercase tracking-widest text-muted">
                {g.day === today ? "Today" : g.day === addDays(today, -1) ? "Yesterday" : formatLong(g.day)}
              </p>
              <ul>
                {g.items.map((e) => {
                  const s = sentence(e, names);
                  const p = e.actorId ? byId.get(e.actorId) : undefined;
                  const line = (
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="tabular w-16 shrink-0 text-xs text-muted">{time(e.at)}</span>
                      {p ? (
                        <Avatar name={p.displayName ?? p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="xs" />
                      ) : (
                        <span className="h-6 w-6 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 text-sm">
                        {s.lead}
                        {s.label && (
                          <>
                            {" "}
                            <b>{s.label}</b>
                          </>
                        )}
                        {s.tail}
                      </span>
                      <span className="shrink-0 rounded-full bg-ground px-2 py-0.5 text-xs text-muted">{e.area}</span>
                    </span>
                  );
                  return (
                    <li key={e.id} className="border-t border-hairline py-2.5 first:border-t-0">
                      {e.changes && e.changes.length > 0 ? (
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center gap-3">
                            {line}
                            <span className="w-10 shrink-0 text-right text-xs font-semibold text-accent group-open:hidden">Show</span>
                            <span className="hidden w-10 shrink-0 text-right text-xs font-semibold text-accent group-open:inline">Hide</span>
                          </summary>
                          <div className="ml-[5.5rem] mt-2 overflow-hidden rounded-lg border border-hairline text-sm">
                            <div className="grid grid-cols-3 bg-ground px-3 py-1.5 text-xs font-semibold text-muted">
                              <span>Field</span>
                              <span>Before</span>
                              <span>After</span>
                            </div>
                            {e.changes.map((c) => (
                              <div key={c.field} className="grid grid-cols-3 gap-2 border-t border-hairline px-3 py-2">
                                <span>{fieldName(c.field)}</span>
                                <span className="break-words text-muted">{val(c.before)}</span>
                                <span className="break-words">{val(c.after)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <div className="flex items-center gap-3">
                          {line}
                          <span className="w-10 shrink-0" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {more && (
            <div className="text-center">
              <Link href={`/admin/activity${params({ before: shown.at(-1)!.at.toISOString() })}`} className="text-sm font-semibold text-accent">
                Older
              </Link>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

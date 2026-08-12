import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Card, SectionHeading } from "@/components/ui";
import {
  loadSchoolAdmin,
  loadSchoolStructure,
  loadSchoolMetrics,
  type ClassRow,
} from "@/lib/queries/school";
import { SCHOOL_TYPE_LABEL } from "@/lib/school";
import { todayISO, formatLong, formatShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function SchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const today = todayISO();
  const { term: rawTerm } = await searchParams;

  const [people, structure] = await Promise.all([
    loadSchoolAdmin(),
    loadSchoolStructure(),
  ]);
  const terms = structure.terms;

  // Which term scopes the progress numbers: an explicit choice, else the term
  // covering today, else all time.
  const current = terms.find((t) => t.startISO <= today && today <= t.endISO);
  const selected =
    rawTerm === "all"
      ? null
      : rawTerm
        ? (terms.find((t) => t.id === rawTerm) ?? null)
        : (current ?? null);

  const metrics = await loadSchoolMetrics(
    selected ? { startISO: selected.startISO, endISO: selected.endISO } : null,
  );
  const statsByUser = new Map(metrics.map((m) => [m.userId, m]));

  // A class shows under every student in it — the owner and anyone it's shared
  // with — so shared classes appear on each member's card.
  const classesByPerson = new Map<string, ClassRow[]>();
  for (const p of structure.people) classesByPerson.set(p.id, []);
  for (const p of structure.people) {
    for (const c of p.classes) {
      classesByPerson.get(p.id)?.push(c);
      for (const uid of c.sharedWith) classesByPerson.get(uid)?.push(c);
    }
  }
  const anyWork =
    people.some((p) => p.items.length > 0) ||
    [...classesByPerson.values()].some((cs) => cs.length > 0);
  const anyStats = metrics.some((m) => m.total > 0);

  return (
    <>
      <AppHeader title="School" subtitle={formatLong(today)} active="school" />

      <main className="mx-auto max-w-4xl px-6 py-6">
        <p className="mb-6 max-w-2xl text-sm text-muted">
          Open assignments and tests. Add your own from your day; a parent can
          add for anyone from the admin panel. Timed classes show on the
          calendar.
        </p>

        {!anyWork ? (
          <Card className="p-6 text-sm text-muted">
            Nothing due right now. Assignments and tests will show here as they
            get added.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {people
              .filter(
                (p) =>
                  p.items.length > 0 ||
                  (classesByPerson.get(p.id)?.length ?? 0) > 0,
              )
              .map((person) => {
                const classes = classesByPerson.get(person.id) ?? [];
                return (
                  <Card key={person.id} className="p-5">
                    <Link
                      href={`/person/${person.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar
                        name={person.name}
                        color={person.color}
                        avatarPath={person.avatarPath}
                        size="sm"
                      />
                      <span className="font-display font-semibold">
                        {person.name}
                      </span>
                      <span className="ml-auto text-xs text-muted">
                        {person.pending === 0
                          ? "all caught up"
                          : `${person.pending} open${
                              person.overdue > 0
                                ? ` \u00b7 ${person.overdue} late`
                                : ""
                            }`}
                      </span>
                    </Link>

                    {classes.length > 0 && (
                      <ul className="mt-4 space-y-1.5">
                        {classes.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  c.color ?? "var(--color-hairline)",
                              }}
                            />
                            <span className="font-medium">{c.name}</span>
                            {c.meeting && (
                              <span className="truncate text-xs text-muted">
                                {c.meeting}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {person.items.length > 0 &&
                      (() => {
                        const groups = new Map<
                          string,
                          { color: string | null; items: typeof person.items }
                        >();
                        for (const it of person.items) {
                          const key = it.className ?? "Other work";
                          if (!groups.has(key))
                            groups.set(key, { color: it.classColor, items: [] });
                          groups.get(key)!.items.push(it);
                        }
                        return (
                          <div className="mt-4 space-y-3 border-t border-hairline pt-4">
                            {[...groups.entries()].map(([name, g]) => (
                              <div key={name}>
                                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{
                                      backgroundColor:
                                        g.color ?? "var(--color-hairline)",
                                    }}
                                  />
                                  {name}
                                </p>
                                <ul className="space-y-1.5">
                                  {g.items.map((it) => (
                                    <li key={it.id} className="text-sm">
                                      <span className="font-medium">
                                        {it.title}
                                      </span>
                                      <span className="ml-2 text-xs text-muted">
                                        {SCHOOL_TYPE_LABEL[it.type]}
                                        <span
                                          className={`tabular ml-2 ${
                                            it.overdue
                                              ? "font-medium text-red-700"
                                              : ""
                                          }`}
                                        >
                                          due {formatShort(it.dueISO)}
                                        </span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                  </Card>
                );
              })}
          </div>
        )}

        <section className="mt-10">
          <SectionHeading>Progress</SectionHeading>

          {terms.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {terms.map((t) => (
                <TermPill
                  key={t.id}
                  href={`/school?term=${t.id}`}
                  label={t.name}
                  active={selected?.id === t.id}
                />
              ))}
              <TermPill
                href="/school?term=all"
                label="All time"
                active={selected === null}
              />
            </div>
          )}

          <p className="mt-2 text-xs text-muted">
            {selected
              ? `${selected.name} \u00b7 ${selected.startISO} \u2013 ${selected.endISO}`
              : "All time"}
            . Tracked, not scored.
          </p>

          {!anyStats ? (
            <Card className="mt-3 p-6 text-sm text-muted">
              No completed or due work in this range yet.
            </Card>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {structure.people.map((p) => {
                const s = statsByUser.get(p.id);
                if (!s || s.total === 0) return null;
                const pct = Math.round((s.completed / s.total) * 100);
                return (
                  <Card key={p.id} className="p-5">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={p.name}
                        color={p.color}
                        avatarPath={p.avatarPath}
                        size="sm"
                      />
                      <span className="font-display font-semibold">
                        {p.name}
                      </span>
                      <span className="tabular ml-auto text-lg font-medium">
                        {pct}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {s.completed} of {s.total} done &middot; {s.onTime} on
                      time
                      {s.overdue > 0 && (
                        <span className="ml-1 font-medium text-red-700">
                          {" "}
                          &middot; {s.overdue} overdue
                        </span>
                      )}
                    </p>

                    {s.byClass.length > 0 && (
                      <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3">
                        {s.byClass.map((c) => (
                          <li
                            key={c.key}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  c.color ?? "var(--color-hairline)",
                              }}
                            />
                            <span className="flex-1 truncate">{c.key}</span>
                            <span className="tabular text-xs text-muted">
                              {c.completed}/{c.total}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function TermPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-hairline text-muted hover:border-accent"
      }`}
    >
      {label}
    </Link>
  );
}

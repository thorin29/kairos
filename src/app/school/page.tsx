import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Card, SectionHeading } from "@/components/ui";
import {
  loadSchoolAdmin,
  loadSchoolStructure,
  loadSchoolMetrics,
  loadClassOptions,
  type ClassRow,
  type SchoolItem,
} from "@/lib/queries/school";
import { SCHOOL_TYPE_LABEL } from "@/lib/school";
import { todayISO, formatShort } from "@/lib/dates";
import { personalVisibleIds } from "@/lib/personal-scope";
import { AddSchoolWork } from "@/components/add-school-work";

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
  const classOptions = await loadClassOptions();
  const terms = structure.terms.filter((t) => !t.pending);

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
  // Personal device: a child sees only their own; a parent sees the children
  // too. Shared tablet shows everyone.
  const visible = await personalVisibleIds();
  const shownPeople = visible
    ? people.filter((p) => visible.includes(p.id))
    : people;

  // Each card shows only what matters day-to-day: overdue work, what's due
  // today, and this week's classes that meet on the calendar — not every lesson.
  const cards = shownPeople
    .map((person) => ({
      person,
      overdueItems: person.items.filter((it) => it.overdue),
      todayItems: person.items.filter((it) => !it.overdue && it.dueISO === today),
      meetingClasses: (classesByPerson.get(person.id) ?? []).filter((c) => c.meeting),
    }))
    .filter(
      (c) => c.overdueItems.length > 0 || c.todayItems.length > 0 || c.meetingClasses.length > 0,
    );
  const anyWork = cards.length > 0;
  const anyStats = metrics.some((m) => m.total > 0);

  return (
    <>
      

      <main className="mx-auto max-w-4xl px-6 py-6">
        <p className="mb-6 max-w-2xl text-sm text-muted">
          Classes, assignments, and tests.
        </p>

        <div className="mb-8">
          <AddSchoolWork
            people={shownPeople.map((p) => ({ id: p.id, name: p.name }))}
            classesByUser={classOptions}
            subjects={structure.subjects.filter((s) => !s.pending).map((s) => s.name)}
            defaultDate={today}
          />
        </div>

        {!anyWork ? (
          <Card className="p-6 text-sm text-muted">
            Nothing due right now. Overdue work, today&rsquo;s work, and this week&rsquo;s classes
            will show here.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map(({ person, overdueItems, todayItems, meetingClasses }) => (
              <Card key={person.id} className="p-5">
                <Link href={`/person/${person.id}`} className="flex items-center gap-3">
                  <Avatar
                    name={person.name}
                    color={person.color}
                    avatarPath={person.avatarPath}
                    avatarPosition={person.avatarPosition}
                    size="sm"
                  />
                  <span className="font-display font-semibold">{person.name}</span>
                  <span className="ml-auto text-xs text-muted">
                    {person.pending === 0
                      ? "all caught up"
                      : `${person.pending} open${person.overdue > 0 ? ` \u00b7 ${person.overdue} late` : ""}`}
                  </span>
                </Link>

                {overdueItems.length > 0 && (
                  <div className="mt-4 border-t border-hairline pt-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                      Overdue
                    </p>
                    <ul className="space-y-1">{overdueItems.map((it) => renderItem(it))}</ul>
                  </div>
                )}

                {todayItems.length > 0 && (
                  <div className="mt-4 border-t border-hairline pt-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      Due today
                    </p>
                    <ul className="space-y-1">{todayItems.map((it) => renderItem(it))}</ul>
                  </div>
                )}

                {meetingClasses.length > 0 && (
                  <div className="mt-4 border-t border-hairline pt-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      This week&rsquo;s classes
                    </p>
                    <ul className="space-y-1.5">
                      {meetingClasses.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 text-sm">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: c.color ?? "var(--color-hairline)" }}
                          />
                          <span className="font-medium">{c.name}</span>
                          {c.meeting && <span className="truncate text-xs text-muted">{c.meeting}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
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
                const pct = s.dueSoFar ? Math.round((s.completedDue / s.dueSoFar) * 100) : null;
                return (
                  <Card key={p.id} className="p-5">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={p.name}
                        color={p.color}
                        avatarPath={p.avatarPath} avatarPosition={p.avatarPosition}
                        size="sm"
                      />
                      <span className="font-display font-semibold">
                        {p.name}
                      </span>
                      <span className="tabular ml-auto text-lg font-medium">
                        {pct === null ? "\u2014" : `${pct}%`}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {s.dueSoFar > 0
                        ? `${s.completedDue} of ${s.dueSoFar} due so far`
                        : "nothing due yet"}
                      {s.onTime > 0 && ` \u00b7 ${s.onTime} on time`}
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
                              {c.completedDue}/{c.dueSoFar}
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

function renderItem(it: SchoolItem) {
  return (
    <li key={it.id} className="flex items-start gap-1.5 text-sm">
      {it.complete && (
        <svg
          viewBox="0 0 20 20"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-label="Completed"
        >
          <path
            d="M4.5 10.5l3.5 3.5L15.5 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="min-w-0">
        <span className="font-medium">{it.className ?? it.subject ?? "School"}</span>
        <span className="ml-2 text-xs text-muted">
          {it.title} &middot; {SCHOOL_TYPE_LABEL[it.type]} &middot;{" "}
          <span className={`tabular ${it.overdue ? "font-medium text-red-700" : ""}`}>
            due {formatShort(it.dueISO)}
          </span>
        </span>
      </span>
    </li>
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

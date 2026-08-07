import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui";
import { loadSchoolAdmin } from "@/lib/queries/school";
import { SCHOOL_TYPE_LABEL } from "@/lib/school";
import { todayISO, formatLong, formatShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function SchoolPage() {
  const today = todayISO();
  const people = await loadSchoolAdmin();
  const anyWork = people.some((p) => p.items.length > 0);

  return (
    <>
      <AppHeader title="School" subtitle={formatLong(today)} active="school" />

      <main className="mx-auto max-w-4xl px-6 py-6">
        {/* Phase 2 will add a term header and each person's classes above this.
            For now the page is the shared view of open assignments and tests. */}
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
            {people.map((person) => (
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
                          person.overdue > 0 ? ` · ${person.overdue} late` : ""
                        }`}
                  </span>
                </Link>

                {person.items.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {person.items.map((it) => (
                      <li key={it.id} className="text-sm">
                        <p className="font-medium">{it.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {[it.subject, SCHOOL_TYPE_LABEL[it.type]]
                            .filter(Boolean)
                            .join(" · ")}
                          <span
                            className={`tabular ml-2 ${
                              it.overdue ? "font-medium text-red-700" : ""
                            }`}
                          >
                            due {formatShort(it.dueISO)}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

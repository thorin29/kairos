import { prisma } from "@/lib/prisma";
import {
  loadChoreSummary,
  loadPoolChores,
} from "@/lib/queries/chores-summary";
import { DAY_SHORT } from "@/lib/days";
import { AddChoreForm } from "./add-chore-form";
import { PoolChores } from "./pool-chores";
import { AssignForm } from "./assign-form";
import { DeleteChoreButton, RemoveAssignmentButton } from "./row-actions";
import { BackLink, DoneBar } from "@/components/back-link";
import { Card, SectionHeading } from "@/components/ui";
import { AlertIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ChoresPage() {
  const [summary, poolChores, people] = await Promise.all([
    loadChoreSummary(),
    loadPoolChores(),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  const unassigned = summary.filter((c) => c.unassigned);

  // Per person, so a parent can see one child's whole week at a glance.
  const byPerson = people.map((p) => ({
    ...p,
    items: summary
      .flatMap((c) =>
        c.assignments
          .filter((a) => a.userId === p.id)
          .map((a) => ({ ...a, chore: c.title })),
      )
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <BackLink />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Chores
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Build the master list first, then assign each chore to a person and
          a day. Assignments repeat every week.
        </p>
      </header>

      {people.length === 0 ? (
        <Card className="p-6 text-sm text-muted">
          Add people to the household first.
        </Card>
      ) : (
        <div className="space-y-10">
          <section>
            <SectionHeading>Master chore list</SectionHeading>
            <Card className="p-5">
              <AddChoreForm />
              {summary.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-5">
                  {summary.map((c) => (
                    <li
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full bg-ground py-1 pl-4 pr-1 text-sm"
                    >
                      {c.title}
                      {c.unassigned && (
                        <span className="ml-1 text-xs text-muted">
                          unassigned
                        </span>
                      )}
                      <DeleteChoreButton id={c.id} title={c.title} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section>
            <SectionHeading>Shared chores</SectionHeading>
            <PoolChores chores={poolChores} />
          </section>

          {summary.length > 0 && (
            <section>
              <SectionHeading>Assign a chore</SectionHeading>
              <Card className="p-5">
                <AssignForm chores={summary} people={people} />
              </Card>
            </section>
          )}

          {unassigned.length > 0 && (
            <Card className="flex items-start gap-3 border-amber-300 bg-amber-50 p-5">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {unassigned.length}{" "}
                  {unassigned.length === 1 ? "chore has" : "chores have"} nobody
                  assigned
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {unassigned.map((c) => c.title).join(", ")} — these never
                  appear on anyone&rsquo;s list.
                </p>
              </div>
            </Card>
          )}

          <section>
            <SectionHeading>Who has what</SectionHeading>
            <div className="grid gap-4 sm:grid-cols-2">
              {byPerson.map((p) => (
                <Card key={p.id} className="p-5">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-6 w-1.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <h3 className="font-display text-lg font-semibold">
                      {p.name}
                    </h3>
                    <span className="tabular ml-auto text-sm text-muted">
                      {p.items.length}
                    </span>
                  </div>
                  {p.items.length === 0 ? (
                    <p className="text-sm text-muted">No chores assigned.</p>
                  ) : (
                    <ul className="divide-y divide-hairline">
                      {p.items.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-3 py-2"
                        >
                          <span className="tabular w-10 shrink-0 text-xs font-medium text-muted">
                            {DAY_SHORT[a.dayOfWeek]}
                          </span>
                          <span className="min-w-0 flex-1 text-sm">
                            {a.chore}
                          </span>
                          <RemoveAssignmentButton
                            id={a.id}
                            label={`${a.chore} on ${DAY_SHORT[a.dayOfWeek]}`}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          </section>

          <section>
            <SectionHeading>Time to catch up</SectionHeading>
            <Card className="divide-y divide-hairline">
              {summary
                .filter((c) => !c.unassigned)
                .map((c) => (
                  <div key={c.id} className="flex flex-wrap gap-3 p-4">
                    <span className="min-w-[10rem] flex-1 text-sm font-medium">
                      {c.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {c.assignments.map((a, i) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1.5 text-xs"
                        >
                          <span
                            aria-hidden
                            className="h-3 w-1 rounded-full"
                            style={{ backgroundColor: a.userColor }}
                          />
                          <span className="text-muted">
                            {a.userName} {DAY_SHORT[a.dayOfWeek]}
                          </span>
                          <span className="tabular text-muted/70">
                            +{c.gaps[i]}d
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </Card>
            <p className="mt-2 text-xs text-muted">
              A chore stays open until the same chore comes due again. The
              number after each slot is how many days that is.
            </p>
          </section>
        </div>
      )}

      <DoneBar />
    </main>
  );
}

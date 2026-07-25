import { prisma } from "@/lib/prisma";
import {
  loadChoreSummary,
  loadPoolChores,
} from "@/lib/queries/chores-summary";
import { DAY_SHORT } from "@/lib/days";
import { AddChoreForm } from "./add-chore-form";
import { PoolChores } from "./pool-chores";
import { AssignForm } from "./assign-form";
import { DeleteChoreButton } from "./row-actions";
import { ChoreCards } from "./chore-cards";
import { AdminBack } from "@/components/admin-back";
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
    id: p.id,
    name: p.name,
    color: p.color,
    items: summary
      .flatMap((c) =>
        c.assignments
          .filter((a) => a.userId === p.id)
          .map((a) => ({ id: a.id, chore: c.title, dayOfWeek: a.dayOfWeek })),
      )
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Chores
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Assign each chore to a person and a day &mdash; assignments repeat
          every week. Drag a card to reorder people, or use the move button on a
          chore to shift it to someone else. The master list of jobs is at the
          bottom.
        </p>
      </header>

      {people.length === 0 ? (
        <Card className="p-6 text-sm text-muted">
          Add people to the household first.
        </Card>
      ) : (
        <div className="space-y-10">
          {summary.length > 0 && (
            <section>
              <SectionHeading>Assign a chore</SectionHeading>
              <Card className="p-5">
                <AssignForm chores={summary} people={people} />
              </Card>
            </section>
          )}

          <section>
            <SectionHeading>Shared chores</SectionHeading>
            <PoolChores chores={poolChores} />
          </section>

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
            <ChoreCards cards={byPerson} people={people} />
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
        </div>
      )}
    </main>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AddChoreForm } from "./add-chore-form";
import { AssignmentGrid } from "./assignment-grid";
import { DeleteChoreButton } from "./delete-chore-button";

export const dynamic = "force-dynamic";

export default async function ChoresPage() {
  const [chores, people] = await Promise.all([
    prisma.chore.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { assignments: { where: { isActive: true } } },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  const rows = chores.map((c) => ({
    id: c.id,
    title: c.title,
    staleAfterDays: c.staleAfterDays,
    byDay: Object.fromEntries(
      c.assignments.map((a) => [a.dayOfWeek, a.userId]),
    ) as Record<number, string>,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-muted underline underline-offset-4 hover:text-accent"
      >
        Everyone
      </Link>

      <header className="mb-8 mt-4 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Chores
        </h1>
        <p className="mt-2 text-muted">
          Set who does what on each day. The same pattern repeats every week,
          and daily lists are created automatically two weeks ahead.
        </p>
      </header>

      {people.length === 0 ? (
        <p className="rounded-xl border border-hairline bg-surface p-6 text-sm text-muted">
          Add people to the household first.
        </p>
      ) : (
        <>
          {rows.length > 0 && (
            <section className="mb-8 rounded-xl border border-hairline bg-surface p-4">
              <AssignmentGrid chores={rows} people={people} />
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline pt-4">
                {rows.map((c) => (
                  <li key={c.id} className="text-xs text-muted">
                    {c.title}{" "}
                    <DeleteChoreButton id={c.id} title={c.title} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <AddChoreForm />

          {rows.length === 0 && (
            <p className="mt-6 text-sm text-muted">
              No chores yet. Add one above and the weekly grid appears here.
            </p>
          )}
        </>
      )}
    </main>
  );
}

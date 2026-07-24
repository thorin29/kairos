import { prisma } from "@/lib/prisma";
import { AddPersonForm } from "./add-person-form";
import { RemovePersonButton } from "./remove-person-button";
import { BackLink, DoneBar } from "@/components/back-link";
import { ScoringStartForm } from "./scoring-start-form";
import { getScoringStart } from "@/lib/settings";
import { SectionHeading } from "@/components/ui";
import { isAdmin } from "@/lib/session";
import { ParentOnly } from "@/components/parent-only";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const people = await prisma.user.findMany({ orderBy: { sortOrder: "asc" } });

  // First run has no accounts, so it must stay open. After that it's
  // parent-only like the rest of the management screens.
  if (people.length > 0 && !(await isAdmin())) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <ParentOnly what="The household list" />
      </main>
    );
  }
  const scoringStart = await getScoringStart();
  const hasAdmin = people.some((p) => p.role === "ADMIN");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      {people.length > 0 && <BackLink />}

      <header className="mb-8 mt-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          Setup
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Who lives here?
        </h1>
        <p className="mt-3 text-muted">
          {people.length === 0
            ? "Start with a parent account. You can add everyone else next, and change any of this later."
            : "Add everyone who needs chores, schoolwork, or a schedule."}
        </p>
      </header>

      {people.length > 0 && (
        <ul className="mb-8 divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className="h-6 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="font-medium">{p.name}</span>
              <span className="text-xs uppercase tracking-wide text-muted">
                {p.role === "ADMIN" ? "Parent" : "Child"}
              </span>
              <span className="ml-auto">
                <RemovePersonButton id={p.id} name={p.name} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-lg border border-hairline bg-surface p-6">
        <AddPersonForm isFirst={people.length === 0} />
      </section>

      {hasAdmin && (
        <>
          <section className="mt-10">
            <SectionHeading>Scoring</SectionHeading>
            <ScoringStartForm current={scoringStart} />
          </section>

          <p className="mt-6 text-sm text-muted">
            {people.length} {people.length === 1 ? "person" : "people"} added.
          </p>
          <DoneBar />
        </>
      )}
    </main>
  );
}

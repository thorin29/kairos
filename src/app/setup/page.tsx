import { prisma } from "@/lib/prisma";
import { AddPersonForm } from "./add-person-form";
import { RemovePersonButton } from "./remove-person-button";
import { BackLink } from "@/components/back-link";
import { AdminBack } from "@/components/admin-back";
import { AdminPinControls } from "./admin-pin-controls";
import { AdminToggle } from "./admin-toggle";
import { FamilyColorPicker } from "./family-color-picker";
import { ResetScoringButton } from "./reset-scoring-button";
import { getScoringStart } from "@/lib/settings";
import { listAccounts } from "@/lib/accounts";
import { AccountRow } from "./account-row";
import { SectionHeading } from "@/components/ui";
import { isAdmin, adminPinSet } from "@/lib/session";
import { getFamilyColor } from "@/lib/settings";
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
  const pinSet = await adminPinSet();
  const familyColor = await getFamilyColor();
  const adminCount = people.filter(
    (p) => p.role === "ADMIN" && p.isActive,
  ).length;
  const accounts = hasAdmin ? await listAccounts() : [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      {people.length > 0 ? <AdminBack /> : <BackLink />}

      <header className="mb-8 mt-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          Setup
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Who lives here?
        </h1>
        <p className="mt-3 text-muted">
          {people.length === 0
            ? "Start with the first person — they become the admin. You can add everyone else next, and change any of this later."
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
              <span className="ml-auto flex items-center gap-2">
                <AdminToggle
                  userId={p.id}
                  name={p.displayName ?? p.name}
                  isAdmin={p.role === "ADMIN"}
                  pinSet={pinSet}
                  isOnlyAdmin={p.role === "ADMIN" && adminCount === 1}
                />
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
            <SectionHeading>Accounts</SectionHeading>
            <p className="mb-3 max-w-xl text-sm text-muted">
              Give someone a personal login for their own phone. Send an invite,
              hand them the one-time link, and they set their own password —
              nobody can create their own account. People without a login still
              appear on the shared tablet as usual.
            </p>
            <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
              {accounts.map((a) => (
                <AccountRow key={a.userId} account={a} />
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <SectionHeading>Admin PIN</SectionHeading>
            <p className="mb-3 max-w-xl text-sm text-muted">
              One shared PIN unlocks admin for whoever needs it. It&rsquo;s
              optional &mdash; leave it off in a single-adult home and the lock
              simply opens admin.
            </p>
            <AdminPinControls pinSet={pinSet} />
          </section>

          <section className="mt-10">
            <SectionHeading>Family calendar color</SectionHeading>
            <p className="mb-3 max-w-xl text-sm text-muted">
              The shared color for birthdays (and, soon, family events and
              holidays) on the calendar &mdash; it&rsquo;s the color of the
              Family filter.
            </p>
            <FamilyColorPicker current={familyColor} />
          </section>

          <section className="mt-10">
            <SectionHeading>Scoring</SectionHeading>
            <ResetScoringButton current={scoringStart} />
          </section>

          <p className="mt-6 text-sm text-muted">
            {people.length} {people.length === 1 ? "person" : "people"} added.
          </p>
        </>
      )}
    </main>
  );
}

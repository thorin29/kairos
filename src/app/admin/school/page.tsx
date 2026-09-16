import Link from "next/link";
import { AdminBack } from "@/components/admin-back";
import { todayISO } from "@/lib/dates";
import { loadRolloverState } from "@/lib/queries/school";
import { loadBreakReminders, loadVacationPrompts } from "@/lib/queries/school-year";
import { RolloverBanner } from "./rollover-banner";
import { BreakReminders } from "./break-reminders";
import { VacationPrompts } from "./vacation-prompts";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    href: "/admin/school/year",
    title: "Set up school year",
    desc: "Semesters, breaks, holidays & the year calendar",
  },
  {
    href: "/admin/school/classes",
    title: "Terms & classes",
    desc: "Classes, subjects, class types & who can edit",
  },
  {
    href: "/admin/school/curriculum",
    title: "Curriculum & schedule",
    desc: "Import curriculum, review & publish, compile a term",
  },
  {
    href: "/admin/school/work",
    title: "Open work",
    desc: "Assignments & tests across the household",
  },
];

export default async function AdminSchoolPage() {
  const today = todayISO();
  const [rollover, breakReminders, vacationPrompts] = await Promise.all([
    loadRolloverState(today),
    loadBreakReminders(today),
    loadVacationPrompts(today),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">School</h1>
        <p className="mt-2 max-w-xl text-muted">
          Set up the school year, manage classes and curriculum, and track assignments across the
          household.
        </p>
      </header>

      {rollover.needed && <RolloverBanner state={rollover} />}
      <BreakReminders breaks={breakReminders} />
      <VacationPrompts vacations={vacationPrompts} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-4 hover:border-accent"
          >
            <span>
              <span className="block text-sm font-medium">{c.title}</span>
              <span className="mt-0.5 block text-xs text-muted">{c.desc}</span>
            </span>
            <span className="shrink-0 text-accent">&rarr;</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

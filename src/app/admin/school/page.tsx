import Link from "next/link";
import { AdminBack } from "@/components/admin-back";
import { todayISO } from "@/lib/dates";
import { loadRolloverState } from "@/lib/queries/school";
import { loadBreakReminders, loadVacationPrompts } from "@/lib/queries/school-year";
import { RolloverBanner } from "./rollover-banner";
import { BreakReminders } from "./break-reminders";
import { VacationPrompts } from "./vacation-prompts";
import {
  CalendarPlusIcon,
  SlidersIcon,
  BookIcon,
  AssignmentIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const TILES = [
  {
    href: "/admin/school/year",
    label: "Set up school year",
    blurb: "Semesters, breaks, holidays & the year calendar",
    icon: <CalendarPlusIcon className="h-7 w-7" />,
  },
  {
    href: "/admin/school/classes",
    label: "Classes & subjects",
    blurb: "Class names, subjects, class types & who can edit",
    icon: <SlidersIcon className="h-7 w-7" />,
  },
  {
    href: "/admin/school/curriculum",
    label: "Curriculum & schedule",
    blurb: "Build or import a class, review & publish, compile a term",
    icon: <BookIcon className="h-7 w-7" />,
  },
  {
    href: "/admin/school/work",
    label: "Student work",
    blurb: "Completed, late & open assignments across the household",
    icon: <AssignmentIcon className="h-7 w-7" />,
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
    <main className="mx-auto max-w-4xl px-6 py-8">
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

      <ul className="grid gap-4 sm:grid-cols-2">
        {TILES.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className="flex h-full flex-col gap-3 rounded-2xl border border-hairline bg-surface p-5 transition-all hover:border-accent hover:shadow-sm"
            >
              <span className="text-accent">{tile.icon}</span>
              <span className="font-display text-lg font-semibold">{tile.label}</span>
              <span className="text-sm text-muted">{tile.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

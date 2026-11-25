import Link from "next/link";
import type { ReactNode } from "react";
import { householdTz } from "@/lib/dates";
import { Avatar } from "@/components/avatar";
import { BibleIcon, CheckIcon, ChoresIcon, DumbbellIcon, SchoolIcon, TasksIcon } from "@/components/icons";
import { CATEGORY_COLORS } from "@/lib/colors";

export type AreaBar = { category: string; total: number; complete: number; overdue: number };

const SHORT: Record<string, string> = { BIBLE: "Bible", EXERCISE: "Workout", CHORE: "Chores", SCHOOL: "School", WORK: "Tasks", OTHER: "Tasks" };
const ICON: Record<string, (c: string) => ReactNode> = {
  BIBLE: (c) => <BibleIcon className={c} />,
  EXERCISE: (c) => <DumbbellIcon className={c} />,
  CHORE: (c) => <ChoresIcon className={c} />,
  SCHOOL: (c) => <SchoolIcon className={c} />,
};
const GREEN = "#16a34a";
const RED = "#dc2626";

function partOfDay(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: householdTz(), hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
  return hour >= 4 && hour <= 11 ? "Morning" : hour >= 12 && hour <= 16 ? "Afternoon" : "Evening";
}

/**
 * The top of the home page (v0.799), the same as the app's: the date, a
 * greeting and a chip per area on the left (green with a check when done,
 * red when something's overdue), the day's progress as a ring on the right.
 * The web keeps the avatar (to the profile) and level and streak as chips.
 */
export function GreetingCard({
  person,
  dateLabel,
  bars,
  extra,
}: {
  person: { id: string; name: string; color: string; avatarPath: string | null; avatarPosition: string | null };
  dateLabel: string;
  bars: AreaBar[];
  /** Level and streak chips. */
  extra?: ReactNode;
}) {
  const total = bars.reduce((n, b) => n + b.total, 0);
  const done = bars.reduce((n, b) => n + b.complete, 0);
  const frac = total ? Math.min(1, done / total) : 0;
  return (
    <section className="flex items-center gap-4 rounded-[20px] border border-hairline bg-surface p-4 sm:p-5">
      <Link
        href={`/person/${person.id}/profile`}
        title="Edit profile"
        aria-label={`Edit ${person.name}'s profile`}
        className="hidden shrink-0 rounded-full transition-transform hover:scale-105 sm:block"
      >
        <Avatar name={person.name} color={person.color} avatarPath={person.avatarPath} avatarPosition={person.avatarPosition} size="lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{dateLabel}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {partOfDay()}, {person.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {total === 0 && <span className="text-sm text-muted">Nothing scheduled yet today.</span>}
          {bars
            .filter((b) => b.total > 0 || b.overdue > 0)
            .map((b) => {
              const short = SHORT[b.category] ?? b.category;
              const complete = b.total > 0 && b.complete >= b.total && b.overdue === 0;
              const color = b.overdue > 0 ? RED : complete ? GREEN : (CATEGORY_COLORS as Record<string, string>)[b.category] ?? "#64748b";
              const text = b.overdue > 0 ? `${short} · ${b.overdue} overdue` : complete ? short : `${short} ${b.complete}/${b.total}`;
              return (
                <span
                  key={b.category}
                  className="tabular inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ color, backgroundColor: `${color}1a` }}
                >
                  {complete ? <CheckIcon className="h-3.5 w-3.5" /> : (ICON[b.category] ?? ((c: string) => <TasksIcon className={c} />))("h-3.5 w-3.5")}
                  {text}
                </span>
              );
            })}
          {extra}
        </div>
      </div>
      {total > 0 && (
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(var(--color-accent) 0 ${frac * 100}%, color-mix(in srgb, currentColor 10%, transparent) 0 100%)` }}
          aria-label={`${done} of ${total} done`}
        >
          <span className="tabular flex h-[52px] w-[52px] items-center justify-center rounded-full bg-surface text-base font-bold">
            {done}/{total}
          </span>
        </div>
      )}
    </section>
  );
}

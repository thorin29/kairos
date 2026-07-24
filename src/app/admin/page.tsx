import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/session";
import { BackLink } from "@/components/back-link";
import { LockButton } from "./lock-button";
import {
  ChoresIcon,
  PeopleIcon,
  CalendarPlusIcon,
  TrophyIcon,
  BookIcon,
  DumbbellIcon,
  SchoolIcon,
  GamepadIcon,
  LockIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

type Tile = {
  href: string;
  label: string;
  blurb: string;
  icon: React.ReactNode;
  ready: boolean;
};

const TILES: Tile[] = [
  {
    href: "/admin/chores",
    label: "Chores",
    blurb: "Master list, weekly assignments, shared chores",
    icon: <ChoresIcon className="h-7 w-7" />,
    ready: true,
  },
  {
    href: "/admin/bible",
    label: "Bible reading",
    blurb: "Build or import a plan, review it, publish it",
    icon: <BookIcon className="h-7 w-7" />,
    ready: true,
  },
  {
    href: "/admin/exercise",
    label: "Exercise",
    blurb: "Routines and per-person programmes",
    icon: <DumbbellIcon className="h-7 w-7" />,
    ready: false,
  },
  {
    href: "/admin/school",
    label: "School",
    blurb: "Classes, terms, and assignment templates",
    icon: <SchoolIcon className="h-7 w-7" />,
    ready: false,
  },
  {
    href: "/admin/games",
    label: "Game time",
    blurb: "Daily limits and weekly tokens",
    icon: <GamepadIcon className="h-7 w-7" />,
    ready: true,
  },
  {
    href: "/setup",
    label: "Household",
    blurb: "People, roles, PINs, scoring start date",
    icon: <PeopleIcon className="h-7 w-7" />,
    ready: true,
  },
  {
    href: "/admin/calendar",
    label: "Calendars",
    blurb: "Subscribed feeds",
    icon: <CalendarPlusIcon className="h-7 w-7" />,
    ready: true,
  },
  {
    href: "/about",
    label: "About",
    blurb: "Version and database check",
    icon: <LockIcon className="h-7 w-7" />,
    ready: true,
  },
  {
    href: "/summary",
    label: "Summary",
    blurb: "Household totals — the shared page everyone sees",
    icon: <TrophyIcon className="h-7 w-7" />,
    ready: true,
  },
];

export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/unlock");

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <BackLink />

      <header className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Admin
          </h1>
          <p className="mt-1 text-sm text-muted">
            Unlocked by {admin.name}. Everything here changes what the whole
            household sees.
          </p>
        </div>
        <LockButton />
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) =>
          tile.ready ? (
            <li key={tile.href}>
              <Link
                href={tile.href}
                className="flex h-full flex-col gap-3 rounded-2xl border border-hairline bg-surface p-5 transition-all hover:border-accent hover:shadow-sm"
              >
                <span className="text-accent">{tile.icon}</span>
                <span className="font-display text-lg font-semibold">
                  {tile.label}
                </span>
                <span className="text-sm text-muted">{tile.blurb}</span>
              </Link>
            </li>
          ) : (
            <li key={tile.href}>
              <div className="flex h-full cursor-not-allowed flex-col gap-3 rounded-2xl border border-dashed border-hairline p-5 opacity-60">
                <span className="text-muted">{tile.icon}</span>
                <span className="font-display text-lg font-semibold">
                  {tile.label}
                </span>
                <span className="text-sm text-muted">{tile.blurb}</span>
                <span className="mt-auto text-xs uppercase tracking-wide text-muted">
                  Not built yet
                </span>
              </div>
            </li>
          ),
        )}
      </ul>
    </main>
  );
}

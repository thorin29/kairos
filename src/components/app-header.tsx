import Link from "next/link";
import {
  HomeIcon,
  CalendarIcon,
  BookIcon,
  ChoresIcon,
  GamepadIcon,
  TrophyIcon,
} from "@/components/icons";

export type Section =
  | "home"
  | "calendar"
  | "bible"
  | "chores"
  | "games"
  | "summary";

/**
 * One navigation bar shared by every page, pinned to the top.
 *
 * Each destination keeps a fixed position in the row, so the bar never
 * reflows as you move between pages — the thing you're aiming at is where it
 * was a moment ago. The current section is filled and slightly larger, which
 * says where you are without a separate label.
 */
const NAV: {
  key: Section;
  href: string;
  label: string;
  color: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "home",
    href: "/",
    label: "Dashboard",
    color: "#0f5c63",
    icon: <HomeIcon className="h-6 w-6" />,
  },
  {
    key: "calendar",
    href: "/calendar",
    label: "Calendar",
    color: "#2563eb",
    icon: <CalendarIcon className="h-6 w-6" />,
  },
  {
    key: "chores",
    href: "/chores",
    label: "Chores",
    color: "#d97706",
    icon: <ChoresIcon className="h-6 w-6" />,
  },
  {
    key: "bible",
    href: "/bible",
    label: "Bible reading",
    color: "#7c3aed",
    icon: <BookIcon className="h-6 w-6" />,
  },
  {
    key: "games",
    href: "/games",
    label: "Game time",
    color: "#059669",
    icon: <GamepadIcon className="h-6 w-6" />,
  },
  {
    key: "summary",
    href: "/summary",
    label: "Summary",
    color: "#db2777",
    icon: <TrophyIcon className="h-6 w-6" />,
  },
];

export function AppHeader({
  title,
  subtitle,
  active,
  children,
}: {
  title: string;
  subtitle?: string;
  active: Section;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-6 mb-6 border-b border-hairline bg-ground/85 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="tabular truncate text-sm text-muted">{subtitle}</p>
          )}
        </div>

        {children}

        <nav aria-label="Sections">
          <ul className="flex items-center gap-1.5">
            {NAV.map((item) => {
              const current = item.key === active;

              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={current ? "page" : undefined}
                    title={item.label}
                    className={[
                      "flex items-center justify-center rounded-full",
                      "transition-all duration-200 ease-out",
                      "hover:-translate-y-0.5 active:translate-y-0",
                      current
                        ? "h-13 w-13 text-white shadow-md"
                        : "h-11 w-11 bg-surface shadow-sm hover:shadow-md",
                    ].join(" ")}
                    style={
                      current
                        ? { backgroundColor: item.color, height: 52, width: 52 }
                        : { color: item.color }
                    }
                  >
                    {item.icon}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}

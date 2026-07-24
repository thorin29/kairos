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
    // Rendered outside every page's content container, so its width is the
    // viewport rather than whatever that page happens to be constrained to.
    // Nesting it inside meant the bar resized between pages, which reads as
    // the whole top of the app jumping.
    <header className="sticky top-0 z-30 border-b border-hairline bg-ground/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <h1 className="font-display min-w-0 flex-1 truncate text-xl font-semibold tracking-tight sm:hidden">
          {title}
        </h1>

        <div className="hidden min-w-0 flex-1 sm:block">
          <h1 className="font-display truncate text-2xl font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="tabular truncate text-sm text-muted">{subtitle}</p>
          )}
        </div>

        {children}

        {/* Scrolls rather than wraps: a second row would change the header's
            height between pages, which is the jumping this bar exists to
            avoid. */}
        <nav
          aria-label="Sections"
          className="min-w-0 shrink overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex items-center gap-1.5 px-1 py-2">
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

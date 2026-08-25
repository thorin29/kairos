"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  HomeIcon,
  CalendarIcon,
  BookIcon,
  BibleIcon,
  ChoresIcon,
  SchoolIcon,
  GamepadIcon,
  TrophyIcon,
  CartIcon,
  DumbbellIcon,
  DollarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { UserBadge } from "@/components/user-badge";

type NavItem = {
  href: string;
  label: string;
  color: string;
  icon: React.ReactNode;
};

// Fixed order, so the target you're aiming at never moves between pages.
const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", color: "#0f5c63", icon: <HomeIcon className="h-6 w-6" /> },
  { href: "/calendar", label: "Calendar", color: "#2563eb", icon: <CalendarIcon className="h-6 w-6" /> },
  { href: "/chores", label: "Chores", color: "#d97706", icon: <ChoresIcon className="h-6 w-6" /> },
  { href: "/bible", label: "Bible reading", color: "#7c3aed", icon: <BibleIcon className="h-6 w-6" /> },
  { href: "/reading", label: "Reading", color: "#0891b2", icon: <BookIcon className="h-6 w-6" /> },
  { href: "/school", label: "School", color: "#4f46e5", icon: <SchoolIcon className="h-6 w-6" /> },
  { href: "/games", label: "Game time", color: "#059669", icon: <GamepadIcon className="h-6 w-6" /> },
  { href: "/exercise", label: "Workouts", color: "#dc2626", icon: <DumbbellIcon className="h-6 w-6" /> },
  { href: "/groceries", label: "Groceries", color: "#0d9488", icon: <CartIcon className="h-6 w-6" /> },
  { href: "/money", label: "Money", color: "#15803d", icon: <DollarIcon className="h-6 w-6" /> },
  { href: "/summary", label: "Characters", color: "#db2777", icon: <TrophyIcon className="h-6 w-6" /> },
];

/** Which nav item owns the current path (longest matching href wins). */
function activeFor(path: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of NAV) {
    const match =
      item.href === "/" ? path === "/" : path.startsWith(item.href);
    if (match && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

const COLLAPSED = "4rem"; // thin icon rail
const EXPANDED = "15rem"; // labelled width

function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Kairos" className={`${className} rounded-lg`} />
  );
}

export function Sidebar({
  initialExpanded,
  user,
}: {
  initialExpanded: boolean;
  user?: { name: string; color: string; avatarPath: string | null } | null;
}) {
  const path = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(initialExpanded);
  // Mobile only: whether the rail is rolled out. It rolls up into the logo by
  // default so a narrow screen isn't eaten by the rail.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Hidden on the full-screen auth pages, which have no app chrome.
  if (
    path.startsWith("/login") ||
    path.startsWith("/join") ||
    path.startsWith("/unlock")
  ) {
    return null;
  }

  const active = activeFor(path);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    document.cookie = `sidebar=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  // The logo: on desktop it's home; on mobile it rolls the rail up/out.
  const onLogo = () => {
    if (isMobile) setMobileOpen((v) => !v);
    else router.push("/");
  };

  const showScrim = isMobile ? mobileOpen : expanded;
  const onScrim = () => (isMobile ? setMobileOpen(false) : toggleExpanded());

  return (
    <>
      {/* When the rail is rolled up on mobile, only the logo shows in the
          corner — tap it to roll the rail back out. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className={`fixed left-3 top-4 z-40 rounded-lg shadow-md md:hidden ${
          mobileOpen ? "hidden" : "block"
        }`}
      >
        <Logo />
      </button>

      {/* Dim the page behind the rail; tap to close/collapse. */}
      {showScrim && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onScrim}
          className="fixed inset-0 z-30 bg-black/20"
        />
      )}

      <nav
        aria-label="Sections"
        className={`fixed inset-y-0 left-0 z-40 flex origin-top-left flex-col bg-[var(--color-sidebar)] text-white shadow-lg transition-all duration-200 ease-out md:scale-100 md:opacity-100 ${
          mobileOpen
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 md:pointer-events-auto pointer-events-none"
        }`}
        style={{ width: expanded ? EXPANDED : COLLAPSED }}
      >
        {/* Logo + (when expanded) the current page name. */}
        <div className="flex h-20 items-center gap-3 px-3">
          <button
            type="button"
            onClick={onLogo}
            aria-label={isMobile ? "Hide menu" : "Kairos home"}
            className="shrink-0"
          >
            <Logo />
          </button>
          {expanded && active && (
            <span className="font-display truncate text-lg font-semibold tracking-tight">
              {active.label}
            </span>
          )}
        </div>

        {/* Icon column. Labels appear only when expanded. */}
        <ul className="flex-1 space-y-1 overflow-y-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => {
            const current = item.href === active?.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={current ? "page" : undefined}
                  title={expanded ? undefined : item.label}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    "flex h-11 items-center gap-3 rounded-xl px-2.5 transition-colors",
                    current
                      ? "bg-white text-ink shadow-sm"
                      : "text-white/85 hover:bg-white/15 hover:text-white",
                  ].join(" ")}
                  style={current ? { color: item.color } : undefined}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {item.icon}
                  </span>
                  {expanded && (
                    <span
                      className="truncate text-sm font-medium"
                      style={current ? { color: "var(--color-ink)" } : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Sign-in, then the collapse/expand control, pinned to the bottom. */}
        <div className="mt-auto space-y-2 border-t border-white/20 px-2 py-3">
          {user && (
            <div className="px-1">
              <UserBadge
                name={user.name}
                color={user.color}
                avatarPath={user.avatarPath}
                inline
                expanded={expanded}
              />
            </div>
          )}
          <button
            type="button"
            onClick={toggleExpanded}
            aria-label={expanded ? "Collapse menu" : "Expand menu"}
            className="flex h-10 w-full items-center gap-3 rounded-xl px-2.5 text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              {expanded ? (
                <ChevronLeftIcon className="h-5 w-5" />
              ) : (
                <ChevronRightIcon className="h-5 w-5" />
              )}
            </span>
            {expanded && <span className="text-sm font-medium">Collapse</span>}
          </button>
        </div>
      </nav>
    </>
  );
}

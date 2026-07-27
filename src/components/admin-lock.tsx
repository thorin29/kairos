"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockIcon } from "@/components/icons";

// Each page's lock jumps straight to the matching admin section.
const SECTION: Record<string, string> = {
  "/": "/admin",
  "/chores": "/admin/chores",
  "/calendar": "/admin/calendar",
  "/exercise": "/admin/exercise",
  "/bible": "/admin/bible",
  "/games": "/admin/games",
  "/groceries": "/admin/groceries",
  "/summary": "/admin",
};

/**
 * A small, unobtrusive lock in the bottom-right of every non-admin page. It
 * takes you to that page's admin section (the main dashboard's goes to the
 * admin overview), so the admin area is one tap away instead of buried.
 */
export function AdminLock() {
  const path = usePathname();

  // Not on the admin area itself, the unlock screen, or setup.
  if (
    path.startsWith("/admin") ||
    path.startsWith("/unlock") ||
    path.startsWith("/setup")
  ) {
    return null;
  }

  const base = "/" + (path.split("/")[1] ?? "");
  const href = SECTION[base] ?? "/admin";

  return (
    <Link
      href={href}
      aria-label="Admin"
      title="Admin"
      className="fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface/80 text-muted opacity-70 shadow-sm backdrop-blur transition-all hover:border-accent hover:text-accent hover:opacity-100"
    >
      <LockIcon className="h-5 w-5" />
    </Link>
  );
}

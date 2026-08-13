"use client";

import { useRouter, usePathname } from "next/navigation";

// Admin sub-pages map back to their own dashboard; the hub goes home.
const DASHBOARDS = new Set([
  "chores",
  "calendar",
  "exercise",
  "bible",
  "games",
  "groceries",
  "money",
]);

/** Leaves the admin panel for the matching dashboard without locking, so the
 *  admin stays unlocked (unlike the Lock button). */
export function CloseAdminButton() {
  const router = useRouter();
  const path = usePathname();

  const section = path.split("/")[2] ?? "";
  const dashboard = DASHBOARDS.has(section) ? `/${section}` : "/";

  return (
    <button
      type="button"
      onClick={() => router.push(dashboard)}
      className="inline-flex h-11 items-center rounded-full border border-hairline px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
    >
      Close admin
    </button>
  );
}

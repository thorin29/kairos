"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons";

// Admin sub-pages map back to their own dashboard; the hub goes home.
const DASHBOARDS = new Set([
  "chores",
  "calendar",
  "exercise",
  "bible",
  "games",
  "groceries",
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
      className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Close admin
    </button>
  );
}

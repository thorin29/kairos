"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { lockAdmin } from "@/lib/actions/session";

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

export function LockButton() {
  const path = usePathname();
  const [pending, startTransition] = useTransition();

  // "/admin/chores" -> "/chores"; "/admin/bible/progress" -> "/bible"; "/admin" -> "/".
  const section = path.split("/")[2] ?? "";
  const dashboard = DASHBOARDS.has(section) ? `/${section}` : "/";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await lockAdmin();
          // Full navigation so the admin chrome clears immediately.
          window.location.assign(dashboard);
        })
      }
      className="inline-flex h-10 items-center rounded-full border border-hairline px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {pending ? "Locking\u2026" : "Lock admin"}
    </button>
  );
}

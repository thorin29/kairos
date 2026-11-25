"use client";

import { pageForAdmin } from "@/lib/admin-sections";
import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { lockAdmin } from "@/lib/actions/session";


export function LockButton() {
  const path = usePathname();
  const [pending, startTransition] = useTransition();

  // "/admin/chores" -> "/chores"; "/admin/bible/progress" -> "/bible"; "/admin" -> "/" (v0.796: one table).
  const dashboard = pageForAdmin(path);

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
      className="inline-flex h-10 items-center rounded-full border border-hairline bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {pending ? "Locking\u2026" : "Lock admin"}
    </button>
  );
}

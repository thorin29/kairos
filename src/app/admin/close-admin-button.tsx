"use client";

import { pageForAdmin } from "@/lib/admin-sections";
import { useRouter, usePathname } from "next/navigation";


/** Leaves the admin panel for the matching dashboard without locking, so the
 *  admin stays unlocked (unlike the Lock button). */
export function CloseAdminButton() {
  const router = useRouter();
  const path = usePathname();

  const dashboard = pageForAdmin(path);

  return (
    <button
      type="button"
      onClick={() => router.push(dashboard)}
      className="inline-flex h-11 items-center rounded-full border border-hairline bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
    >
      Close admin
    </button>
  );
}

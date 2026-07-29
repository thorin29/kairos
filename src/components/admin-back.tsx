import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { LockButton } from "@/app/admin/lock-button";
import { CloseAdminButton } from "@/app/admin/close-admin-button";

/**
 * "Admin Menu" goes back to the hub. On the right, "Close admin" leaves for the
 * matching dashboard while staying unlocked, and "Lock admin" does the same but
 * locks on the way out.
 */
export function AdminBack() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/admin"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-accent bg-accent/10 px-4 text-sm font-medium text-accent transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Admin Menu
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <CloseAdminButton />
        <LockButton />
      </div>
    </div>
  );
}

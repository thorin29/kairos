import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { LockButton } from "@/app/admin/lock-button";
import { CloseAdminButton } from "@/app/admin/close-admin-button";

/**
 * "Admin Menu" goes back to the hub; a page inside a section (Settings →
 * Device, School → Classes) goes back to that section first (v0.796), with
 * the hub one more tap away. On the right, "Close admin" leaves for the
 * matching dashboard while staying unlocked, and "Lock admin" does the same but
 * locks on the way out.
 */
export function AdminBack({ parent }: { parent?: { href: string; label: string } } = {}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={parent?.href ?? "/admin"}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-accent bg-accent/10 px-4 text-sm font-medium text-accent transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {parent?.label ?? "Admin Menu"}
      </Link>
      {parent && (
        <Link href="/admin" className="inline-flex h-11 items-center px-2 text-sm font-medium text-muted hover:text-accent">
          Admin Menu
        </Link>
      )}
      <div className="ml-auto flex items-center gap-2">
        <CloseAdminButton />
        <LockButton />
      </div>
    </div>
  );
}

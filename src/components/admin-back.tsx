import Link from "next/link";
import { ArrowLeftIcon, HomeIcon } from "@/components/icons";

/**
 * Admin sub-pages are reached from the admin hub, so "back" means the hub —
 * but leaving for the dashboard is just as common, and one button can't be
 * both.
 */
export function AdminBack() {
  const base =
    "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/admin"
        className={`${base} border-accent bg-accent/10 text-accent`}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Admin
      </Link>
      <Link
        href="/"
        className={`${base} border-hairline text-muted hover:border-accent hover:text-accent`}
      >
        <HomeIcon className="h-4 w-4" />
        Dashboard
      </Link>
    </div>
  );
}

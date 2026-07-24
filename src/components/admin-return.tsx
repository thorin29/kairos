import Link from "next/link";
import { isAdmin } from "@/lib/session";
import { ArrowLeftIcon } from "@/components/icons";

/**
 * Some admin tiles open a page the whole household can see — the summary,
 * the chore metrics — because there is no separate parent version of them.
 * Landing there with no way back to the hub reads as a dead end, so a return
 * link appears while the admin unlock is live and is invisible otherwise.
 */
export async function AdminReturn({ className }: { className?: string }) {
  if (!(await isAdmin())) return null;

  return (
    <div className={className ?? "mb-5"}>
      <Link
        href="/admin"
        className="inline-flex h-10 items-center gap-2 rounded-full border border-accent bg-accent/10 px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to admin
      </Link>
    </div>
  );
}

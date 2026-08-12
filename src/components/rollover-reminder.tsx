"use client";

import Link from "next/link";
import { useTransition } from "react";
import { snoozeRollover } from "@/lib/actions/school";
import { SchoolIcon } from "@/components/icons";

/**
 * A shared reminder that shows on every admin's dashboard card once a term has
 * ended and nothing newer is set up. It's backed by the household-wide rollover
 * state, so whichever admin acts on it clears it for both: setting up the new
 * term removes it for good, and "Later" snoozes it for everyone until the
 * reminder interval passes.
 */
export function RolloverReminder({
  fromTermName,
}: {
  fromTermName: string | null;
}) {
  const [busy, start] = useTransition();

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
      <div className="flex items-center gap-2">
        <SchoolIcon className="h-4 w-4 shrink-0 text-accent" />
        <p className="text-sm font-medium">Start the new semester</p>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {fromTermName ? `${fromTermName} has ended.` : "The last term has ended."}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Link
          href="/admin/school"
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-all hover:brightness-110"
        >
          Set it up
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => start(() => void snoozeRollover())}
          className="rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
        >
          {busy ? "\u2026" : "Later"}
        </button>
      </div>
    </div>
  );
}

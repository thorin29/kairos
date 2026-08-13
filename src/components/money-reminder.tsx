import Link from "next/link";
import { DollarIcon, BookIcon } from "@/components/icons";

/**
 * Rides each admin's dashboard card when money needs attention — transactions
 * waiting to be verified, and/or Bible-reading rewards ready to grant. The
 * same household-wide counts for every admin, so acting on them clears the
 * card for all at once.
 */
export function MoneyReminder({
  count,
  bibleRewards = 0,
}: {
  count: number;
  bibleRewards?: number;
}) {
  if (count <= 0 && bibleRewards <= 0) return null;
  return (
    <div className="space-y-2 rounded-lg border border-amber-300/50 bg-amber-50 p-3">
      {count > 0 && (
        <div className="flex items-center gap-2">
          <DollarIcon className="h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-sm font-medium text-amber-900">
            {count} {count === 1 ? "transaction" : "transactions"} to approve
          </p>
        </div>
      )}
      {bibleRewards > 0 && (
        <div className="flex items-center gap-2">
          <BookIcon className="h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-sm font-medium text-amber-900">
            Bible reading {bibleRewards === 1 ? "reward" : "rewards"} ready
            {bibleRewards > 1 ? ` (${bibleRewards} months)` : ""}
          </p>
        </div>
      )}
      <div>
        <Link
          href="/admin/money"
          className="inline-block rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:brightness-110"
        >
          Review
        </Link>
      </div>
    </div>
  );
}

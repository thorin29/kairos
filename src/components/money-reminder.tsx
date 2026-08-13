import Link from "next/link";
import { DollarIcon } from "@/components/icons";

/**
 * Rides each admin's dashboard card when transactions are waiting to be
 * verified — the same household-wide count for everyone, so once they're
 * approved it clears on every admin's card at once.
 */
export function MoneyReminder({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3">
      <div className="flex items-center gap-2">
        <DollarIcon className="h-4 w-4 shrink-0 text-amber-700" />
        <p className="text-sm font-medium text-amber-900">
          {count} {count === 1 ? "transaction" : "transactions"} to approve
        </p>
      </div>
      <div className="mt-2">
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

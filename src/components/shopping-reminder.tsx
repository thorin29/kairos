import Link from "next/link";
import { CartIcon } from "@/components/icons";
import type { DashboardTrip } from "@/lib/queries/groceries";

/**
 * Rides the card of whoever is out shopping: one tappable line per active trip
 * that opens their cart on the groceries page. Only shown on that person's own
 * card, so it reads as "your shopping run".
 */
export function ShoppingReminder({ trips }: { trips: DashboardTrip[] }) {
  if (trips.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-lg border border-teal-300/50 bg-teal-50 p-3">
      {trips.map((t) => (
        <Link
          key={t.tripId}
          href="/groceries"
          className="flex items-center gap-2 text-sm font-medium text-teal-900 hover:underline"
        >
          <CartIcon className="h-4 w-4 shrink-0 text-teal-700" />
          <span className="min-w-0 flex-1 truncate">
            Shopping {t.storeName}
          </span>
          <span className="tabular shrink-0 text-xs text-teal-700">
            {t.got}/{t.total}
          </span>
        </Link>
      ))}
    </div>
  );
}

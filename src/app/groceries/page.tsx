import { loadGroceries } from "@/lib/queries/groceries";
import { currentUser } from "@/lib/user-session";
import { deviceMode } from "@/lib/device";
import { GroceryBoard } from "./grocery-board";

export const dynamic = "force-dynamic";

export default async function GroceriesPage() {
  const [data, me, mode] = await Promise.all([
    loadGroceries(),
    currentUser(),
    deviceMode(),
  ]);

  // A cart only opens on the shopper's own personal device; the shared hub and
  // everyone else see a trip as a status line.
  const meId = mode === "personal" && me ? me.id : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      {data.stores.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
          No stores yet. A parent can add one from the admin area.
        </p>
      ) : (
        <GroceryBoard
          stores={data.stores}
          saved={data.saved}
          trips={data.trips}
          catalog={data.catalog}
          roster={data.roster}
          meId={meId}
        />
      )}
    </main>
  );
}

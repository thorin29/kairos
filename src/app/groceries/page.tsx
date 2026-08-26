import { loadGroceries } from "@/lib/queries/groceries";
import { GroceryBoard } from "./grocery-board";

export const dynamic = "force-dynamic";

export default async function GroceriesPage() {
  const data = await loadGroceries();

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      {data.stores.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
          No stores yet. A parent can add one from the admin area.
        </p>
      ) : (
        <GroceryBoard
          stores={data.stores}
          items={data.items}
          catalog={data.catalog}
        />
      )}
    </main>
  );
}

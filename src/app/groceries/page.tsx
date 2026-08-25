import { prisma } from "@/lib/prisma";
import { loadGroceries } from "@/lib/queries/groceries";
import { GroceryBoard } from "./grocery-board";

export const dynamic = "force-dynamic";

export default async function GroceriesPage() {
  const [data, roster] = await Promise.all([
    loadGroceries(),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true, avatarPath: true },
    }),
  ]);

  const needed = data.items.filter((i) => !i.bought).length;

  return (
    <>
      

      <main className="mx-auto max-w-4xl px-6 py-6">
        {data.stores.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
            No stores yet. A parent can add one from the admin area.
          </p>
        ) : (
          <GroceryBoard
            stores={data.stores}
            items={data.items}
            suggestions={data.suggestions}
            roster={roster}
          />
        )}
      </main>
    </>
  );
}

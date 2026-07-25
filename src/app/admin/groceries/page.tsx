import { AdminBack } from "@/components/admin-back";
import { SectionHeading } from "@/components/ui";
import { loadGroceryAdmin } from "@/lib/queries/groceries";
import { GroceryAdmin } from "./grocery-admin";

export const dynamic = "force-dynamic";

export default async function AdminGroceriesPage() {
  const { stores, catalog } = await loadGroceryAdmin();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Groceries
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Stores to shop at, and the catalog the list remembers. The catalog
          fills itself in as people add things — this is where you seed an
          initial list, fix an icon, or tuck something away.
        </p>
      </header>

      <section>
        <SectionHeading>Stores</SectionHeading>
        <GroceryAdmin stores={stores} catalog={catalog} />
      </section>
    </main>
  );
}

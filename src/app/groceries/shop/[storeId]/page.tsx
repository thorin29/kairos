import Link from "next/link";
import { loadCart } from "@/lib/queries/groceries";
import { currentUser } from "@/lib/user-session";
import { deviceMode } from "@/lib/device";
import { CartView } from "./cart-view";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const [cart, me, mode] = await Promise.all([
    loadCart(storeId),
    currentUser(),
    deviceMode(),
  ]);

  if (!cart) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-6">
        <div className="rounded-2xl border border-hairline bg-surface p-8 text-center">
          <p className="text-3xl">🛒</p>
          <p className="mt-2 text-sm text-muted">
            No shopping trip is under way here.
          </p>
          <Link
            href="/groceries"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-white"
          >
            Back to groceries
          </Link>
        </div>
      </main>
    );
  }

  // The checklist is interactive only for the shopper on their own device;
  // everyone else (and the shared hub) sees it read-only.
  const interactive =
    mode === "personal" && !!me && me.id === cart.trip.shopper.id;

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <CartView
        store={cart.store}
        trip={cart.trip}
        interactive={interactive}
      />
    </main>
  );
}

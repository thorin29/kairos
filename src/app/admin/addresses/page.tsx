import { AdminBack } from "@/components/admin-back";
import { loadAddressAdmin } from "@/lib/queries/addresses";
import { AddressAdmin } from "./address-admin";

export const dynamic = "force-dynamic";

export default async function AdminAddressesPage() {
  const { addresses } = await loadAddressAdmin();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Addresses
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          A shared address book. Give each place a short name and its full
          address; when you set a location on a calendar event you can pick from
          these instead of retyping, and directions sent to a phone use the full
          address. It's one searchable list — every address is offered on every
          event, so you enter each place just once.
        </p>
      </header>

      <AddressAdmin addresses={addresses} />
    </main>
  );
}

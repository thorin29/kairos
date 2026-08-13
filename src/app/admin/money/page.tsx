import { AdminBack } from "@/components/admin-back";
import { loadMoneyAdmin } from "@/lib/queries/money";
import { AdminMoney } from "./admin-money";

export const dynamic = "force-dynamic";

export default async function AdminMoneyPage() {
  const { pending, all, people } = await loadMoneyAdmin();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Money
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Approve transactions people have filed, and edit or remove any row.
          Balances on the Money page already reflect every transaction —
          approving is the verification mark, not what makes the number move.
        </p>
      </header>

      <AdminMoney pending={pending} all={all} people={people} />
    </main>
  );
}

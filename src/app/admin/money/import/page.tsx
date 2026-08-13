import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminBack } from "@/components/admin-back";
import { balancesRecord } from "@/lib/queries/money";
import { todayISO } from "@/lib/dates";
import { MoneyImport } from "./money-import";

export const dynamic = "force-dynamic";

export default async function MoneyImportPage() {
  const [roster, balances] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    balancesRecord(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-6 mt-5 border-b border-hairline pb-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Import transactions
          </h1>
          <Link
            href="/admin/money"
            className="text-sm text-muted hover:text-accent"
          >
            Back to Money
          </Link>
        </div>
        <p className="mt-2 max-w-xl text-muted">
          Bring one person&rsquo;s history in from a CSV. Every row is reviewed
          here before anything is saved; imported rows come in already approved.
        </p>
      </header>

      <MoneyImport roster={roster} balances={balances} today={todayISO()} />
    </main>
  );
}

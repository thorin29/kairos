import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { loadMoneyPage } from "@/lib/queries/money";
import { todayISO } from "@/lib/dates";
import { formatDollars } from "@/lib/money";
import { MoneyView } from "@/components/money-view";
import { DollarIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { user } = await searchParams;
  const { participants, selectedId, rows } = await loadMoneyPage(user);

  // The overlay's picker offers everyone active — a new person joins the left
  // rail the moment they have a row, so the picker can't be limited to people
  // who already appear there.
  const roster = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const selected = participants.find((p) => p.id === selectedId) ?? null;
  const today = todayISO();

  return (
    <>
      <AppHeader title="Money" subtitle="Balances and transactions" active="money" />

      <main className="mx-auto max-w-6xl px-6 py-6">
        {participants.length === 0 ? (
          <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
            <DollarIcon className="mx-auto h-8 w-8 text-muted" />
            <h2 className="mt-3 font-display text-lg font-semibold">
              No money tracked yet
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Add a deposit or set starting funds for someone and they&rsquo;ll
              appear here.
            </p>
            <div className="mt-5">
              <MoneyView
                roster={roster}
                selectedId={null}
                selectedName={null}
                balanceCents={0}
                today={today}
                rows={[]}
                emptyMode
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Left rail: only people who keep a ledger. */}
            <nav className="shrink-0 sm:w-48">
              <ul className="flex gap-2 overflow-x-auto sm:flex-col sm:gap-1 sm:overflow-visible">
                {participants.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/money?user=${p.id}`}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-foreground hover:bg-ink/5"
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: p.color }}
                        />
                        <span className="whitespace-nowrap">{p.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Right: the selected person's total and their transactions. */}
            <section className="min-w-0 flex-1">
              {selected && (
                <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-hairline pb-4">
                  <h2 className="font-display text-xl font-semibold">
                    {selected.name}
                  </h2>
                  <span
                    className={`tabular text-2xl font-semibold ${
                      selected.balanceCents < 0
                        ? "text-red-600"
                        : "text-foreground"
                    }`}
                  >
                    {formatDollars(selected.balanceCents)}
                  </span>
                </div>
              )}

              <MoneyView
                roster={roster}
                selectedId={selectedId}
                selectedName={selected?.name ?? null}
                balanceCents={selected?.balanceCents ?? 0}
                today={today}
                rows={rows}
              />
            </section>
          </div>
        )}
      </main>
    </>
  );
}

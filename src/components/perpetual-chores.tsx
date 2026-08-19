"use client";

import { useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { logPerpetualChore, undoPerpetualChore } from "@/lib/actions/chores";
import type { PerpetualChore } from "@/lib/queries/chores-summary";

/** Dashboard section for throughout-the-day chores: tap a face each time
 *  someone does it; counts show for the day. */
export function PerpetualChores({
  chores,
  people,
}: {
  chores: PerpetualChore[];
  people: { id: string; name: string; color: string }[];
}) {
  const [pending, start] = useTransition();
  if (chores.length === 0) return null;

  const countFor = (c: PerpetualChore, userId: string) =>
    c.byUser.find((u) => u.id === userId)?.count ?? 0;

  return (
    <section>
      <h2 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
        Throughout the day
      </h2>
      <div className="space-y-3">
        {chores.map((c) => (
          <div key={c.id} className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">{c.title}</p>
              <span className="tabular text-xs text-muted">
                {c.total === 0 ? "not yet today" : `done ${c.total}\u00d7 today`}
                {c.total > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => void (await undoPerpetualChore(c.id, c.byUser[c.byUser.length - 1]?.id ?? "")))
                    }
                    className="ml-2 text-muted underline hover:text-ink disabled:opacity-50"
                  >
                    undo
                  </button>
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => {
                const n = countFor(c, p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => void (await logPerpetualChore(c.id, p.id)))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                      n > 0
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-hairline text-muted hover:border-accent"
                    }`}
                    title={`${p.name} did it`}
                  >
                    <Avatar name={p.name} color={p.color} size="xs" />
                    {p.name}
                    {n > 0 && <span className="tabular font-semibold">{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

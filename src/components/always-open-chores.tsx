"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeAlwaysOpenChore } from "@/lib/actions/chores";
import { Card } from "@/components/ui";
import { RefreshIcon } from "@/components/icons";
import type { AlwaysOpenChore } from "@/lib/queries/chores-summary";

type Person = { id: string; name: string; color: string };

/** Dashboard section for always-open chores: tap a person each time it's done;
 *  each tap is an instant, scored completion and the chore stays available
 *  (or steps aside for its cooldown, then comes back). */
export function AlwaysOpenChores({
  chores,
  people,
}: {
  chores: AlwaysOpenChore[];
  people: Person[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick once a second only while something is cooling down, so countdowns
  // move and the chore re-enables itself when its timer runs out.
  const anyCooling = chores.some((c) => c.readyAtMs && c.readyAtMs > nowMs);
  useEffect(() => {
    if (!anyCooling) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [anyCooling]);

  useEffect(() => {
    // When a cooldown elapses, pull fresh counts/state from the server.
    for (const c of chores) {
      if (c.readyAtMs && c.readyAtMs <= nowMs) {
        router.refresh();
        break;
      }
    }
  }, [nowMs, chores, router]);

  if (chores.length === 0) return null;

  const countFor = (c: AlwaysOpenChore, userId: string) =>
    c.byUser.find((u) => u.id === userId)?.count ?? 0;

  const backIn = (readyAtMs: number) => {
    const secs = Math.max(0, Math.round((readyAtMs - nowMs) / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        Always open
      </h2>
      <div className="space-y-3">
        {chores.map((c) => {
          const cooling = Boolean(c.readyAtMs && c.readyAtMs > nowMs);
          return (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="min-w-[9rem] flex-1">
                  <p className="font-medium">
                    {c.title}
                    {c.total > 0 && (
                      <span className="tabular ml-1.5 font-normal text-muted">
                        &times;{c.total} today
                      </span>
                    )}
                  </p>
                  {cooling && c.readyAtMs && (
                    <p className="tabular mt-0.5 flex items-center gap-1 text-xs text-muted">
                      <RefreshIcon className="h-3.5 w-3.5" />
                      back in {backIn(c.readyAtMs)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {people.map((p) => {
                    const n = countFor(c, p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={pending || cooling}
                        onClick={() => {
                          setError(null);
                          start(async () => {
                            const res = await completeAlwaysOpenChore(c.id, p.id);
                            if (res.error) setError(res.error);
                            else router.refresh();
                          });
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                      >
                        <span
                          aria-hidden
                          className="h-3.5 w-1 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
                        {n > 0 && (
                          <span className="tabular font-semibold text-muted">{n}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Each tap counts for whoever did it, as often as it happens.
      </p>
    </section>
  );
}

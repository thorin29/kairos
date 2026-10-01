"use client";

import { useState, useTransition } from "react";
import { hatchEgg } from "@/lib/actions/companions";

/**
 * Shown under a person's egg once it has grown. They choose a new companion (a
 * fresh random creature they don't own) or to deepen the one they have.
 *
 * Deepening costs the egg but not one of the season's three hatches, so it is
 * offered even when the month's hatches are spent ([capped]) — that is the only
 * thing on offer then. It is hidden when the companion is already shiny, where
 * it would spend the egg and change nothing.
 */
export function HatchControls({
  userId,
  hasActive,
  capped = false,
  shiny = false,
}: {
  userId: string;
  hasActive: boolean;
  capped?: boolean;
  shiny?: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const go = (mode: "new" | "deepen") =>
    start(async () => {
      setMsg(null);
      const r = await hatchEgg(userId, mode);
      if (r.error) setMsg(r.error);
      else if (r.hatched) setMsg(`It's ${r.hatched}!`);
      else setMsg("Done!");
    });

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {!capped && (
          <button
            type="button"
            disabled={pending}
            onClick={() => go("new")}
            className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Hatching\u2026" : "Hatch a new companion"}
          </button>
        )}
        {hasActive && !shiny && (
          <button
            type="button"
            disabled={pending}
            onClick={() => go("deepen")}
            className="inline-flex h-10 items-center rounded-full border border-hairline px-5 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {capped ? "Make it shiny" : "Deepen instead"}
          </button>
        )}
      </div>
      {capped && (
        <p className="text-xs text-muted">
          All three hatches used this month — a shiny doesn&apos;t cost one.
        </p>
      )}
      {msg && <p className="text-sm font-medium text-emerald-700">{msg}</p>}
    </div>
  );
}

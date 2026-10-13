"use client";

import { useState, useTransition } from "react";
import { hatchEgg } from "@/lib/actions/companions";

/**
 * The choice at the end of a companion's growth.
 *
 * Only ever shown when an egg actually exists, which now means one thing: the
 * companion is fully grown, or it has finished deepening. There is no monthly
 * allowance any more, so there is no "capped" state to explain — growth paces
 * hatching on its own.
 *
 * Deepen is offered only to a plain adult. A creature still growing has not
 * earned it, and one already deepened has nothing left to deepen — both of
 * which the server refuses too, so this is the convenience, not the rule.
 */
export function HatchControls({
  userId,
  phase,
}: {
  userId: string;
  /** Only "adult" and "shiny" ever reach here; the others have no egg. */
  phase: "growing" | "adult" | "deepening" | "shiny";
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const go = (mode: "new" | "deepen") =>
    start(async () => {
      setMsg(null);
      const r = await hatchEgg(userId, mode);
      if (r.error) setMsg(r.error);
      else if (r.hatched) setMsg(`It's ${r.hatched}!`);
      else setMsg("Deepening has begun — the glow will show when it's done.");
    });

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => go("new")}
          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Hatching…" : "Hatch a new companion"}
        </button>
        {phase === "adult" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => go("deepen")}
            className="inline-flex h-10 items-center rounded-full border border-hairline px-5 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Deepen instead
          </button>
        )}
      </div>
      {phase === "adult" && (
        <p className="max-w-xs text-center text-xs text-muted">
          Deepening keeps this companion and makes it shiny. It takes a little
          more work, and the glow is how you&apos;ll know it&apos;s done.
        </p>
      )}
      {msg && <p className="text-sm font-medium text-emerald-700">{msg}</p>}
    </div>
  );
}

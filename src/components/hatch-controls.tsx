"use client";

import { useState, useTransition } from "react";
import { hatchEgg } from "@/lib/actions/companions";

/**
 * Shown under a person's egg when it's ready. They choose a new companion (a
 * fresh random creature they don't own) or to deepen the one they have.
 */
export function HatchControls({
  userId,
  hasActive,
}: {
  userId: string;
  hasActive: boolean;
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
        <button
          type="button"
          disabled={pending}
          onClick={() => go("new")}
          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Hatching\u2026" : "Hatch a new companion"}
        </button>
        {hasActive && (
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
      {msg && <p className="text-sm font-medium text-emerald-700">{msg}</p>}
    </div>
  );
}

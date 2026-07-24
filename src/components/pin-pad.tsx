"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { unlockAdmin, type UnlockState } from "@/lib/actions/session";

const initial: UnlockState = { error: null, ok: false };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Digits only, entered on screen. A text input on a tablet brings up a full
 * keyboard and accepts letters that can never be part of a PIN, which is
 * what made the first version feel broken.
 */
export function PinPad({ next = "/admin" }: { next?: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [state, formAction, pending] = useActionState(unlockAdmin, initial);

  useEffect(() => {
    if (state.ok) router.push(next);
  }, [state.ok, next, router]);

  useEffect(() => {
    if (state.error) setPin("");
  }, [state.error]);

  const press = (d: string) => setPin((p) => (p.length < 8 ? p + d : p));

  const key =
    "flex h-16 items-center justify-center rounded-2xl border border-hairline bg-surface font-display text-2xl font-medium transition-colors hover:border-accent hover:text-accent active:bg-accent/10";

  return (
    <form action={formAction} className="mx-auto max-w-xs">
      <input type="hidden" name="pin" value={pin} />

      <div
        className="mb-6 flex h-14 items-center justify-center gap-3 rounded-2xl border border-hairline bg-surface"
        aria-live="polite"
        aria-label={`${pin.length} digits entered`}
      >
        {pin.length === 0 ? (
          <span className="text-sm text-muted">Enter PIN</span>
        ) : (
          Array.from({ length: pin.length }, (_, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-full bg-ink"
              aria-hidden
            />
          ))
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={key}>
            {d}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setPin("")}
          className={`${key} text-sm text-muted`}
        >
          Clear
        </button>

        <button type="button" onClick={() => press("0")} className={key}>
          0
        </button>

        <button
          type="button"
          onClick={() => setPin((p) => p.slice(0, -1))}
          aria-label="Delete last digit"
          className={`${key} text-sm text-muted`}
        >
          &larr;
        </button>
      </div>

      {state.error && (
        <p role="alert" className="mt-5 text-center text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || pin.length < 4}
        className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-accent text-base font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-40"
      >
        {pending ? "Checking\u2026" : "Unlock"}
      </button>
    </form>
  );
}

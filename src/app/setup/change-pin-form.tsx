"use client";

import { useActionState } from "react";
import { changePin, type PinState } from "@/lib/actions/people";

const initial: PinState = { error: null, saved: false };

const field =
  "tabular h-11 w-36 rounded-full border border-hairline px-5 tracking-[0.2em] outline-none focus:border-accent";

/**
 * Changing a PIN happens inside the admin area, so the current PIN has
 * already been proven. Asking for it again would be theatre.
 */
export function ChangePinForm({
  userId,
  name,
  hasPin,
}: {
  userId: string;
  name: string;
  hasPin: boolean;
}) {
  const [state, formAction, pending] = useActionState(changePin, initial);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="userId" value={userId} />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor={`pin-${userId}`}
            className="mb-1.5 block text-sm font-medium"
          >
            {hasPin ? `New PIN for ${name}` : `Set a PIN for ${name}`}
          </label>
          <input
            id={`pin-${userId}`}
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            placeholder="4-8 digits"
            className={field}
          />
        </div>

        <div>
          <label
            htmlFor={`confirm-${userId}`}
            className="mb-1.5 block text-sm font-medium"
          >
            Again
          </label>
          <input
            id={`confirm-${userId}`}
            name="confirm"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            className={field}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving\u2026" : hasPin ? "Change PIN" : "Set PIN"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p className="mt-2 text-sm font-medium text-emerald-700">
          PIN updated.
        </p>
      )}
    </form>
  );
}

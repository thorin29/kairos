"use client";

import { useActionState, useEffect } from "react";
import { redeemInviteAction, type RedeemState } from "@/lib/actions/accounts";

const initial: RedeemState = { error: null, ok: false };

const field =
  "h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-base outline-none transition-colors focus:border-accent";

/** Set a password against a one-time invite token. On success the person is
 *  signed in and dropped on the dashboard. */
export function RedeemForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    redeemInviteAction,
    initial,
  );

  useEffect(() => {
    // Full navigation (not router.push) so the layout re-runs with the new
    // session — otherwise the sidebar and personal view lag until a refresh.
    if (state.ok) window.location.assign("/");
  }, [state.ok]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Choose a password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          className={field}
        />
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          className={field}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-accent text-base font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-40"
      >
        {pending ? "Setting up\u2026" : "Create account"}
      </button>
    </form>
  );
}

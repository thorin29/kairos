"use client";

import { useActionState, useEffect } from "react";
import { loginUser, type LoginState } from "@/lib/actions/accounts";

const initial: LoginState = { error: null, ok: false };

const field =
  "h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-base outline-none transition-colors focus:border-accent";

/** Name + password. Deliberately plain: this is a personal sign-in on a phone,
 *  not the tablet PIN pad. */
export function LoginForm({ next = "/" }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginUser, initial);

  useEffect(() => {
    // A full navigation (not router.push) so the root layout re-runs with the
    // new session — otherwise the sidebar and personal view don't appear until
    // a manual refresh, since a shared layout isn't re-rendered on soft nav.
    if (state.ok) window.location.assign(next);
  }, [state.ok, next]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium">
          Name or email
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          className={field}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pending ? "Signing in\u2026" : "Sign in"}
      </button>
    </form>
  );
}

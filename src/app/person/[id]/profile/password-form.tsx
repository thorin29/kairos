"use client";

import { useState, useTransition } from "react";
import { changeOwnPasswordAction } from "@/lib/actions/accounts";
import { Card } from "@/components/ui";

const field =
  "h-11 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";

/** Change your own password. Shown only on your own profile, when you sign in
 *  with one. Other browsers and phones then ask for the new password. */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const mismatch = again.length > 0 && next !== again;
  const ready = current.length > 0 && next.length > 0 && next === again;

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await changeOwnPasswordAction({ current, next });
      if (r.ok) {
        setCurrent("");
        setNext("");
        setAgain("");
        setMsg({ ok: true, text: "Password changed. Other devices will ask for it." });
      } else setMsg({ ok: false, text: r.error ?? "Couldn't change it." });
    });

  return (
    <Card className="mt-6 p-5">
      <h2 className="font-display text-lg font-semibold">Password</h2>
      <div className="mt-3 grid gap-3">
        <label className="text-sm font-medium">
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={`mt-1 ${field}`}
          />
        </label>
        <label className="text-sm font-medium">
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={`mt-1 ${field}`}
          />
        </label>
        <label className="text-sm font-medium">
          New password again
          <input
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            className={`mt-1 ${field} ${mismatch ? "border-red-400" : ""}`}
            aria-invalid={mismatch}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!ready || pending}
          className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Change password"}
        </button>
        {mismatch && <span className="text-sm text-red-700">The new passwords don&rsquo;t match.</span>}
        {msg && (
          <span role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </Card>
  );
}

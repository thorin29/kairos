"use client";

import { useState, useTransition } from "react";
import { saveHockeyAction, testHockeyAction } from "@/lib/actions/hockey";
import type { HockeyConfig } from "@/lib/hockey";

const field =
  "h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";
const labelCls = "mb-1 block text-sm font-medium";

export function HockeyForm({ initial }: { initial: HockeyConfig }) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState(initial.url);
  const [token, setToken] = useState("");
  const [tokenSet, setTokenSet] = useState(initial.tokenSet);
  const [clearToken, setClearToken] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () =>
    startTransition(async () => {
      setMsg(null);
      const res = await saveHockeyAction({ url, token, clearToken });
      if (res.error) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      if (token.trim()) setTokenSet(true);
      else if (clearToken) setTokenSet(false);
      setToken("");
      setClearToken(false);
      if (!url.trim()) {
        setMsg({ ok: true, text: "Saved. Hockey is hidden." });
        return;
      }
      const t = await testHockeyAction();
      setMsg({ ok: t.ok, text: t.ok ? `Saved. ${t.message}` : `Saved, but: ${t.message}` });
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div>
          <label className={labelCls} htmlFor="hockey-url">
            ice-time address
          </label>
          <input
            id="hockey-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.1.10:8095"
            autoCapitalize="none"
            autoComplete="off"
            className={field}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="hockey-token">
            Feed token{" "}
            {tokenSet && <span className="font-normal text-muted">(set — blank keeps it)</span>}
          </label>
          <input
            id="hockey-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="new-password"
            placeholder={tokenSet ? "••••••••" : "The FEED_TOKEN set on ice-time"}
            className={field}
          />
          {tokenSet && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clearToken}
                onChange={(e) => setClearToken(e.target.checked)}
                className="h-4 w-4"
              />
              Remove the saved token
            </label>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Checking…" : "Save and test"}
        </button>
      </div>

      {msg && (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            msg.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}

      <p className="text-sm text-muted">
        Add to calendar names events &ldquo;Section: Rink&rdquo;, uses the{" "}
        <span className="font-medium text-ink">Hockey practice</span> event type when
        there is one, and fills in the location from a saved address named after the
        rink.
      </p>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setDeviceModeAction,
  setRequireLoginAction,
} from "@/lib/actions/device";
import type { DeviceMode } from "@/lib/device";

export function DeviceControls({
  mode,
  requireLogin,
  loginable,
  pinSet,
  edgeEnforced,
}: {
  mode: DeviceMode;
  requireLogin: boolean;
  loginable: number;
  pinSet: boolean;
  edgeEnforced: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pickMode = (next: DeviceMode) => {
    if (next === mode) return;
    setError(null);
    start(async () => {
      const r = await setDeviceModeAction(next);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  };

  const toggleGate = (on: boolean) => {
    setError(null);
    start(async () => {
      const r = await setRequireLoginAction(on);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-5">
        <div>
          <p className="font-medium">This device</p>
          <p className="text-sm text-muted">
            Shared shows the whole household — for the wall tablet. Personal
            shows only the signed-in person — for a phone. This is remembered on
            this device only.
          </p>
        </div>

        <div className="flex gap-2">
          {(["shared", "personal"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pickMode(m)}
              disabled={pending}
              className={`h-11 flex-1 rounded-full border text-sm font-medium capitalize transition-colors disabled:opacity-50 ${
                mode === m
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-hairline bg-ground text-muted hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Require sign-in</p>
            <p className="text-sm text-muted">
              Off, the dashboard is open — right for a LAN-only screen. On,
              every page needs a personal login, which is what makes it safe to
              reach over a public domain. Keep Authelia in front regardless.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={requireLogin}
            onClick={() => toggleGate(!requireLogin)}
            disabled={pending || (!requireLogin && (loginable === 0 || !pinSet))}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
              requireLogin ? "bg-accent" : "bg-ink/15"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                requireLogin ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        {loginable === 0 && (
          <p className="text-sm text-amber-700">
            No one has a login yet. Invite someone in Household → Accounts before
            turning this on, or you&rsquo;ll lock everyone out.
          </p>
        )}

        {loginable > 0 && !pinSet && !requireLogin && (
          <p className="text-sm text-amber-700">
            Set an admin PIN first (the lock button above), so the admin area
            isn&rsquo;t open to everyone once sign-in is required.
          </p>
        )}

        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            edgeEnforced
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {edgeEnforced ? (
            <p>
              <span className="font-semibold">Edge enforcement is on.</span> The
              sign-in gate runs on every request, so it&rsquo;s safe to expose
              this behind Authelia.
            </p>
          ) : (
            <p>
              <span className="font-semibold">
                Not safe for a public domain yet.
              </span>{" "}
              The in-app toggle alone doesn&rsquo;t protect every navigation. To
              go public, set the{" "}
              <code className="rounded bg-black/5 px-1">REQUIRE_LOGIN=true</code>{" "}
              and{" "}
              <code className="rounded bg-black/5 px-1">SESSION_SECRET</code>{" "}
              container variables (and keep Authelia in front).
            </p>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

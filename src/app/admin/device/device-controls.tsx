"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDeviceModeAction } from "@/lib/actions/device";
import { setAdminIdleAction } from "@/lib/actions/admin-lock";

const IDLE_LABELS: [number, string][] = [
  [5, "5 min"],
  [15, "15 min"],
  [30, "30 min"],
  [60, "1 hr"],
  [240, "4 hr"],
];
import type { DeviceMode } from "@/lib/device";

export function DeviceControls({
  mode,
  pinSet,
  idleMinutes,
}: {
  mode: DeviceMode;
  pinSet: boolean;
  idleMinutes: number;
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

  const pickIdle = (minutes: number) => {
    if (minutes === idleMinutes) return;
    setError(null);
    start(async () => {
      const r = await setAdminIdleAction(minutes);
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

      {pinSet && (
        <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-5">
          <div>
            <p className="font-medium">Auto-lock</p>
            <p className="text-sm text-muted">Locks admin after no use for</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {IDLE_LABELS.map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => pickIdle(m)}
                disabled={pending}
                className={`h-11 flex-1 rounded-full border px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                  idleMinutes === m
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-hairline bg-ground text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

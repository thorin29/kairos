"use client";

import { useRef, useState, useTransition } from "react";
import { DeviceIcon, TrashIcon, CheckIcon } from "@/components/icons";
import {
  issueEnrollmentCodeAction,
  listDevicesAction,
  revokeDeviceAction,
} from "@/lib/actions/enrollment";

type DeviceView = {
  id: string;
  name: string | null;
  createdAt: string | Date;
  lastSeenAt: string | Date | null;
  expiresAt: string | Date;
  revokedAt: string | Date | null;
};

type Reveal = { code: string; qrSvg: string; expiresAt: string };

const btn =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors disabled:opacity-50";

function when(d: string | Date | null): string {
  if (!d) return "never";
  const t = new Date(d).getTime();
  const secs = Math.round((Date.now() - t) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

function deviceStatus(d: DeviceView): {
  label: string;
  tone: string;
  live: boolean;
} {
  if (d.revokedAt)
    return { label: "Revoked", tone: "bg-ink/5 text-muted", live: false };
  if (new Date(d.expiresAt).getTime() < Date.now())
    return { label: "Expired", tone: "bg-amber-500/10 text-amber-700", live: false };
  return {
    label: "Active",
    tone: "bg-emerald-500/10 text-emerald-700",
    live: true,
  };
}

/**
 * A person's phone-app access: generate a one-time enrollment code (shown as a
 * code and a QR, once), and see or revoke the phones already enrolled to them.
 * Independent of web login — a person can have a phone with no password, or the
 * reverse. Collapsed until opened, so the household list stays light and no
 * device query runs for people you don't expand.
 */
export function DeviceEnrollment({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);

  const refresh = () =>
    listDevicesAction(userId).then((list) => {
      setDevices(list as DeviceView[]);
      setLoaded(true);
    });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) startTransition(() => refresh());
  };

  const generate = () =>
    startTransition(async () => {
      setCopied(false);
      const res = await issueEnrollmentCodeAction(userId);
      setReveal(res);
      await refresh();
    });

  const revoke = (id: string) =>
    startTransition(async () => {
      await revokeDeviceAction(id);
      await refresh();
    });

  const copy = async () => {
    if (!reveal) return;
    if (window.isSecureContext && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(reveal.code);
        setCopied(true);
        return;
      } catch {
        /* fall through */
      }
    }
    const el = codeRef.current;
    if (el) {
      el.focus();
      el.select();
      try {
        if (document.execCommand("copy")) setCopied(true);
      } catch {
        /* ignore */
      }
    }
  };

  const liveCount = devices.filter((d) => deviceStatus(d).live).length;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className={`${btn} bg-ink/5 text-ink hover:bg-ink/10`}
        aria-expanded={open}
      >
        <DeviceIcon className="h-4 w-4" />
        Phone app
        {loaded && liveCount > 0 && (
          <span className="ml-0.5 rounded-full bg-accent/15 px-1.5 text-xs font-semibold text-accent">
            {liveCount}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-hairline bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{name}&rsquo;s phones</p>
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              className={`${btn} bg-accent text-white hover:brightness-110`}
            >
              <DeviceIcon className="h-4 w-4" />
              {reveal ? "New code" : "Enroll a phone"}
            </button>
          </div>

          {reveal && (
            <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
              <p className="mb-2 text-xs font-medium text-accent">
                One-time code — enter or scan it in the app now. It won&rsquo;t
                be shown again and expires soon.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
                <div
                  className="h-36 w-36 shrink-0 rounded-lg bg-white p-2 text-ink"
                  // Our own [A-Z2-9] code only — no injection surface.
                  dangerouslySetInnerHTML={{ __html: reveal.qrSvg }}
                />
                <div className="w-full">
                  <div className="flex items-center gap-2">
                    <input
                      ref={codeRef}
                      readOnly
                      value={reveal.code}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 text-center font-mono text-lg tracking-widest outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <button
                      type="button"
                      onClick={copy}
                      className={`${btn} shrink-0 bg-accent text-white hover:brightness-110`}
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        "Copy"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ul className="mt-3 space-y-1.5">
            {!loaded ? (
              <li className="px-1 py-2 text-sm text-muted">Loading…</li>
            ) : devices.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted">
                No phones enrolled yet.
              </li>
            ) : (
              devices.map((d) => {
                const s = deviceStatus(d);
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg bg-ink/[0.03] px-3 py-2"
                  >
                    <DeviceIcon className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {d.name || "Unnamed device"}
                      </span>
                      <span className="block text-xs text-muted">
                        {s.live
                          ? `Last active ${when(d.lastSeenAt)}`
                          : d.revokedAt
                            ? `Revoked ${when(d.revokedAt)}`
                            : "Token expired"}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.tone}`}
                    >
                      {s.label}
                    </span>
                    {d.revokedAt === null && (
                      <button
                        type="button"
                        onClick={() => revoke(d.id)}
                        disabled={pending}
                        className={`${btn} shrink-0 px-2.5 text-red-700 hover:bg-red-500/10`}
                        aria-label={`Revoke ${d.name || "device"}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

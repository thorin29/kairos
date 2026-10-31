"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { connectConcept2Account, disconnectConcept2Account } from "@/lib/actions/workouts";
import type { Concept2Status } from "@/lib/workouts/concept2-run";

const field =
  "h-11 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";

function when(iso: string | null): string {
  if (!iso) return "not yet";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "not yet"
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Connect this person's Concept2 Logbook: rows then land on the day page. */
export function Concept2Form({ userId, status }: { userId: string; status: Concept2Status }) {
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const connect = () =>
    start(async () => {
      setMsg(null);
      const r = await connectConcept2Account(userId, token);
      if ("ok" in r) {
        setToken("");
        setMsg({ ok: true, text: "Connected." });
      } else setMsg({ ok: false, text: r.error });
    });

  return (
    <Card className="mt-6 p-5">
      <h2 className="font-display text-lg font-semibold">Concept2</h2>
      {status.connected ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm">
            Connected <span className="text-muted">· last checked {when(status.checkedAt)}</span>
          </p>
          {status.error && <p className="text-sm text-red-700">{status.error}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => disconnectConcept2Account(userId))}
            className="inline-flex h-10 items-center rounded-full border border-hairline px-4 text-sm font-semibold text-accent hover:border-accent disabled:opacity-40"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          <label className="text-sm font-medium">
            Logbook token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={`mt-1 ${field}`}
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              <a
                href="https://log.concept2.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                Concept2 Logbook
              </a>{" "}
              → Edit Profile → Applications
            </span>
          </label>
          <div>
            <button
              type="button"
              disabled={pending || token.trim().length < 16}
              onClick={connect}
              className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
            >
              {pending ? "Connecting…" : "Connect"}
            </button>
          </div>
        </div>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
    </Card>
  );
}

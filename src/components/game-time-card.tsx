"use client";

import { useState, useTransition } from "react";
import { logPlay } from "@/lib/actions/games";
import { Card } from "@/components/ui";
import { GamepadIcon, TokenIcon } from "@/components/icons";
import type { GameStatus } from "@/lib/queries/games";

const QUICK = [15, 30, 45, 60];

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function GameTimeCard({ status }: { status: GameStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pct =
    status.allowanceToday > 0
      ? Math.min(100, Math.round((status.usedToday / status.allowanceToday) * 100))
      : 0;

  const over = status.usedToday > status.allowanceToday;

  const log = (minutes: number, useToken: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await logPlay(status.userId, minutes, useToken);
      if (res.error) setError(res.error);
    });
  };

  return (
    <Card className={`p-5 ${pending ? "opacity-60" : ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <GamepadIcon className="h-5 w-5 text-muted" />
        <h3 className="text-sm font-medium">Game time</h3>
        <span className="tabular ml-auto text-sm">
          <span className={over ? "font-medium text-red-700" : "font-medium"}>
            {hhmm(status.remainingToday)}
          </span>
          <span className="ml-1 text-xs text-muted">left today</span>
        </span>
      </div>

      <div
        className="mb-2 flex h-2 w-full overflow-hidden rounded-full bg-hairline"
        aria-hidden
      >
        <span
          style={{
            width: `${pct}%`,
            backgroundColor: over ? "#dc2626" : status.color,
          }}
        />
      </div>

      <p className="tabular text-xs text-muted">
        {hhmm(status.usedToday)} of {hhmm(status.allowanceToday)} used
        {over && <span className="ml-2 font-medium text-red-700">over</span>}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK.map((m) => (
          <button
            key={m}
            type="button"
            disabled={pending}
            onClick={() => log(m, false)}
            className="inline-flex h-9 items-center rounded-full border border-hairline px-3.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            +{m}m
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <TokenIcon className="h-4 w-4" />
          <span className="tabular">
            {status.tokensLeft} of {status.weeklyTokens}
          </span>
          tokens left
        </span>

        <button
          type="button"
          disabled={pending || status.tokensLeft === 0}
          onClick={() => log(status.tokenMinutes, true)}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-40"
        >
          <TokenIcon className="h-4 w-4" />
          Use a token (+{status.tokenMinutes}m)
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </Card>
  );
}

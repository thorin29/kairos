"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import type { GameMonitorRow } from "@/lib/queries/game-monitor";

const XBOX_GREEN = "#107C10";

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function GBadge() {
  return (
    <span
      className="flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
      style={{ backgroundColor: XBOX_GREEN }}
    >
      G
    </span>
  );
}

function WalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      style={{ color: XBOX_GREEN }}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Wallet"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function StatusChips({ r }: { r: GameMonitorRow }) {
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {r.gamerscore != null && (
        <span className="flex items-center gap-1.5" title="Gamerscore">
          <GBadge />
          <span className="tabular">{r.gamerscore.toLocaleString()}</span>
        </span>
      )}
      {r.hasGamePass && (
        <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">
          Game Pass
        </span>
      )}
      {r.msBalance && (
        <span className="flex items-center gap-1.5" title="Wallet balance">
          <WalletIcon />
          <span className="tabular">{r.msBalance}</span>
        </span>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tabular text-lg font-semibold">{value}</div>
      <div className="text-[0.65rem] uppercase tracking-widest text-muted">{label}</div>
    </div>
  );
}

function TopGames({ r }: { r: GameMonitorRow }) {
  if (r.games.length === 0) return null;
  return (
    <div className="mt-4 border-t border-hairline pt-3">
      <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
        Top games this week
      </div>
      <div className="space-y-1.5">
        {r.games.map((g) => (
          <div key={g.game} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{g.game}</span>
            <span className="tabular shrink-0 text-muted">{hhmm(g.minutes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekChart({ days }: { days: { label: string; minutes: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.minutes));
  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {days.map((d, i) => (
          <div
            key={i}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            {d.minutes > 0 && (
              <span className="tabular text-[0.6rem] text-muted">{hhmm(d.minutes)}</span>
            )}
            <div
              className="w-full rounded-t"
              style={{
                height: `${(d.minutes / max) * 100}%`,
                minHeight: d.minutes > 0 ? 4 : 0,
                backgroundColor: XBOX_GREEN,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {days.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[0.65rem] text-muted">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Overlay({ row, onClose }: { row: GameMonitorRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Avatar
            name={row.name}
            color={row.color}
            avatarPath={row.avatarPath}
            avatarPosition={row.avatarPosition}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold">{row.name}</div>
            <StatusChips r={row} />
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-muted hover:bg-hairline/60"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Today" value={hhmm(row.today)} />
          <Stat label="This week" value={hhmm(row.week)} />
          <Stat label="This month" value={hhmm(row.month)} />
        </div>

        <div className="mt-6 border-t border-hairline pt-4">
          <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
            This week
          </div>
          <WeekChart days={row.weekDaily} />
        </div>

        <TopGames r={row} />
      </div>
    </div>
  );
}

export function GameCards({ rows }: { rows: GameMonitorRow[] }) {
  const [selected, setSelected] = useState<GameMonitorRow | null>(null);

  return (
    <>
      <div className="space-y-4">
        {rows.map((r) => (
          <button
            key={r.userId}
            type="button"
            onClick={() => setSelected(r)}
            className="block w-full text-left transition hover:opacity-90"
          >
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Avatar
                  name={r.name}
                  color={r.color}
                  avatarPath={r.avatarPath}
                  avatarPosition={r.avatarPosition}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <StatusChips r={r} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="Today" value={hhmm(r.today)} />
                <Stat label="This week" value={hhmm(r.week)} />
                <Stat label="This month" value={hhmm(r.month)} />
              </div>

              <TopGames r={r} />
            </Card>
          </button>
        ))}
      </div>

      {selected && <Overlay row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

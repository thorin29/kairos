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

function XboxLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" style={{ color: "#107C10" }} fill="currentColor" aria-label="Xbox">
      <path d="M4.102 21.033A11.947 11.947 0 0 0 12 24a11.96 11.96 0 0 0 7.902-2.967c1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912A11.943 11.943 0 0 0 24 12.004a11.95 11.95 0 0 0-3.57-8.536s-.027-.02-.082-.038c-.063-.021-.152-.033-.264-.03-.786.024-2.36.968-4.823 3.226zM3.654 3.426c-.06.026-.087.046-.087.046A11.946 11.946 0 0 0 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91C6.29 4.36 4.71 3.42 3.926 3.394c-.104-.006-.197.007-.272.032zM12 3.478c1.437-.858 2.837-1.442 3.987-1.687C14.78.664 13.435.283 12.001.283c-1.435 0-2.776.379-3.987 1.51 1.146.243 2.548.827 3.986 1.685z" />
    </svg>
  );
}

function SteamLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" style={{ color: "#1b2838" }} fill="currentColor" aria-label="Steam">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}

function PlatformIcons({ platforms }: { platforms: string[] }) {
  if (!platforms || platforms.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1" title={platforms.join(" + ")}>
      {platforms.includes("xbox") && <XboxLogo />}
      {platforms.includes("steam") && <SteamLogo />}
    </span>
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
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-semibold">{row.name}</span>
              <PlatformIcons platforms={row.platforms} />
            </div>
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
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{r.name}</span>
                    <PlatformIcons platforms={r.platforms} />
                  </div>
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

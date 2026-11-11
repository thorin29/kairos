"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "./plan-file-panel";
import { LineChart } from "@/components/line-chart";
import { REP_BANDS } from "@/lib/workouts/records";
import { formatShort } from "@/lib/dates";
import { estimatedMax, liftTrend, lightWeeks } from "@/lib/workouts/lift-stats";
import { liftNextAction } from "@/lib/actions/workouts";
import type { GraphSeries } from "@/lib/queries/workouts";
import { coreValueText, type CoreMove } from "@/lib/workouts/core-moves";

const sorted = (pts: GraphSeries["points"]) => [...pts].sort((a, b) => (a.date < b.date ? -1 : 1));
const setText = (v: number, reps?: number | null) => `${v}${reps ? ` × ${reps}` : ""}`;

/** A small line of the top set per session, last 12 sessions. */
function Spark({ points, color }: { points: GraphSeries["points"]; color: string }) {
  const pts = sorted(points).slice(-12);
  if (pts.length < 2) return <span className="w-[84px] shrink-0" aria-hidden="true" />;
  const vals = pts.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const xy = pts.map((p, i) => [4 + (i * 76) / (pts.length - 1), 26 - ((p.value - lo) / Math.max(1, hi - lo)) * 22]);
  const last = xy[xy.length - 1];
  return (
    <svg width="84" height="30" viewBox="0 0 84 30" className="shrink-0" aria-hidden="true">
      <polyline
        points={xy.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}

function TrendText({ s, todayISO }: { s: GraphSeries; todayISO: string }) {
  const t = liftTrend(s.points, s.best, todayISO);
  if (!t) return <span className="w-16 shrink-0" />;
  return (
    <span className="flex w-16 shrink-0 flex-col items-end text-right">
      {t.kind === "up" ? (
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          +{t.delta} {s.unit}
        </span>
      ) : (
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Flat</span>
      )}
      <span className="text-[11px] text-muted">
        {t.kind === "up" ? "30 days" : `${t.weeks} ${t.weeks === 1 ? "week" : "weeks"}`}
      </span>
    </span>
  );
}

/**
 * A muscle group's lifts as one row each (v0.670; replaced six tiles per
 * movement): best and last set, a small line, and the 30-day change or how
 * long it's been flat. A row opens the lift's page.
 */
export function LiftRows({
  series,
  color,
  todayISO,
  onOpen,
}: {
  series: GraphSeries[];
  color: string;
  todayISO: string;
  onOpen: (s: GraphSeries) => void;
}) {
  const lifts = series.filter((s) => s.best);
  if (lifts.length === 0) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-hairline bg-surface">
      {lifts.map((s, i) => {
        const last = sorted(s.points).at(-1);
        return (
          <button
            key={s.exerciseId}
            type="button"
            onClick={() => onOpen(s)}
            className={`flex min-h-[56px] w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ground/50 ${
              i > 0 ? "border-t border-hairline" : ""
            }`}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 text-sm font-semibold">{s.name}</span>
              <span className="truncate text-xs text-muted">
                Best {setText(s.best!.value, s.best!.reps)}
                {last ? ` · last ${setText(last.value, last.reps)}` : ""}
              </span>
            </span>
            <Spark points={s.points} color={color} />
            <TrendText s={s} todayISO={todayISO} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-muted" aria-hidden="true">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function Tile({ k, v, sub, tone }: { k: string; v: string; sub: string; tone?: "up" | "flat" }) {
  return (
    <div className="rounded-xl border border-hairline bg-ground/40 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{k}</p>
      <p
        className={`tabular mt-0.5 text-lg font-semibold ${
          tone === "up" ? "text-emerald-700 dark:text-emerald-400" : tone === "flat" ? "text-amber-700 dark:text-amber-400" : ""
        }`}
      >
        {v}
      </p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}

/**
 * One lift's page (v0.670): every session's top set, with light weeks shaded,
 * changed days (sick, hurt…) marked, the record circled and the next planned
 * top set ahead; then its numbers, an estimated max among them, the best
 * weight at each rep count and the recent sessions.
 */
export function LiftPage({
  userId,
  series: s,
  color,
  groupLabel,
  marks,
  todayISO,
  onClose,
}: {
  userId: string;
  series: GraphSeries;
  color: string;
  groupLabel: string;
  marks: { date: string; label: string }[];
  todayISO: string;
  onClose: () => void;
}) {
  const [band, setBand] = useState("all");
  const [next, setNext] = useState<{ date: string; weight: number; reps: number } | null>(null);
  useEffect(() => {
    let live = true;
    liftNextAction(userId, s.exerciseId)
      .then((n) => live && setNext(n))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId, s.exerciseId]);

  const pts = useMemo(() => sorted(s.points), [s.points]);
  const bands = REP_BANDS.filter((b) => s.bands?.some((x) => x.key === b.key));
  const shown = band === "all" ? pts : (s.bands?.find((x) => x.key === band)?.points ?? []);
  const first = pts[0];
  const last = pts.at(-1);
  const from = first?.date ?? todayISO;
  const trend = liftTrend(s.points, s.best, todayISO);
  const est = estimatedMax(s.repMaxes, s.unit);
  const weeksSince = s.best ? Math.max(0, Math.floor((Date.parse(`${todayISO}T12:00:00Z`) - Date.parse(`${s.best.date}T12:00:00Z`)) / (7 * 86400000))) : null;
  const dayName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const reps = [...(s.repMaxes ?? [])].sort((a, b) => a.reps - b.reps);
  const repTop = Math.max(1, ...reps.map((r) => r.value));

  return (
    <Modal title={s.name} onClose={onClose}>
      <div className="space-y-4">
        <p className="-mt-2 text-sm font-semibold" style={{ color }}>
          {groupLabel}
        </p>
        {bands.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reps">
            {[{ key: "all", label: "All" }, ...bands].map((b) => (
              <button
                key={b.key}
                type="button"
                aria-pressed={band === b.key}
                onClick={() => setBand(b.key)}
                className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition-colors ${
                  band === b.key ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
        <LineChart
          key={band}
          weight
          dots
          legend={false}
          series={[{ id: s.exerciseId, name: s.name, color, unit: s.unit, points: shown }]}
          shade={lightWeeks(pts)}
          marks={marks.filter((m) => m.date >= from && m.date <= todayISO)}
          ring={band === "all" && s.best ? { date: s.best.date, value: s.best.value } : null}
          ahead={band === "all" && next ? { date: next.date, value: next.weight, label: `${dayName(next.date)} ${setText(next.weight, next.reps)}` } : null}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile k="Record" v={s.best ? setText(s.best.value, s.best.reps) : "—"} sub={s.best ? formatShort(s.best.date) : "none yet"} />
          <Tile k="Est. max" v={est ? `${est} ${s.unit}` : "—"} sub={est ? "one rep, estimated" : "needs a set of 12 or fewer"} />
          <Tile
            k="30 days"
            v={trend?.kind === "up" ? `+${trend.delta} ${s.unit}` : trend?.kind === "flat" ? "Flat" : "—"}
            sub={trend?.kind === "up" ? "still climbing" : trend?.kind === "flat" ? "no gain" : "no older session"}
            tone={trend?.kind}
          />
          <Tile k="Since best" v={weeksSince == null ? "—" : weeksSince < 1 ? "This week" : `${weeksSince} ${weeksSince === 1 ? "week" : "weeks"}`} sub={s.best ? formatShort(s.best.date) : ""} />
          <Tile k="Sessions" v={`${pts.length}`} sub={first ? `since ${formatShort(first.date)}` : ""} />
          <Tile k="Last" v={last ? setText(last.value, last.reps) : "—"} sub={last ? formatShort(last.date) : ""} />
        </div>
        {reps.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Best weight for each rep count</p>
            {reps.map((r) => (
              <div key={r.reps} className="mt-1.5 flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted">
                  {r.reps} rep{r.reps === 1 ? "" : "s"}
                </span>
                <span className="h-2 min-w-0 flex-1 rounded-full bg-ground">
                  <span className="block h-2 rounded-full" style={{ width: `${(r.value / repTop) * 100}%`, background: color }} />
                </span>
                <span className="tabular w-20 shrink-0 text-right text-xs font-semibold">
                  {r.value} {s.unit}
                </span>
              </div>
            ))}
          </div>
        )}
        {pts.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Recent sessions</p>
            <ul className="mt-1 divide-y divide-hairline text-sm">
              {pts
                .slice(-5)
                .reverse()
                .map((p) => (
                  <li key={p.date} className="flex justify-between py-2">
                    <span>{formatShort(p.date)}</span>
                    <span className="tabular text-muted">
                      {setText(p.value, p.reps)} {s.unit}
                      {p.intent === "LIGHT" ? " · light" : p.intent === "TEST" ? " · test" : ""}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Core's trend: "+15 s" / "+3 reps" over 30 days, else weeks since the best. */
function CoreTrend({ m, todayISO }: { m: CoreMove; todayISO: string }) {
  const t = liftTrend(m.points, m.best, todayISO);
  if (!t) return <span className="w-16 shrink-0" />;
  return (
    <span className="flex w-16 shrink-0 flex-col items-end text-right">
      {t.kind === "up" ? (
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          +{t.delta} {m.kind === "time" ? "s" : "reps"}
        </span>
      ) : (
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Flat</span>
      )}
      <span className="text-[11px] text-muted">
        {t.kind === "up" ? "30 days" : `${t.weeks} ${t.weeks === 1 ? "week" : "weeks"}`}
      </span>
    </span>
  );
}

/**
 * Core's movements as rows (v0.671), by what they're done for — a hold's time
 * or reps — not weight: a weighted crunch is still about the reps, so its
 * weight shows as context ("12 × 25 lb"). A row opens the movement's page.
 */
export function CoreRows({
  moves,
  color,
  unit,
  todayISO,
  onOpen,
}: {
  moves: CoreMove[];
  color: string;
  unit: string;
  todayISO: string;
  onOpen: (m: CoreMove) => void;
}) {
  if (moves.length === 0) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-hairline bg-surface">
      {moves.map((m, i) => {
        const last = m.points.at(-1);
        return (
          <button
            key={m.movement}
            type="button"
            onClick={() => onOpen(m)}
            className={`flex min-h-[56px] w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ground/50 ${
              i > 0 ? "border-t border-hairline" : ""
            }`}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 text-sm font-semibold">{m.name}</span>
              <span className="truncate text-xs text-muted">
                {m.best ? `Best ${coreValueText(m.kind, m.best.value, m.best.weight, unit)}` : ""}
                {last ? ` · last ${coreValueText(m.kind, last.value, last.weight, unit)}` : ""}
              </span>
            </span>
            <Spark points={m.points} color={color} />
            <CoreTrend m={m} todayISO={todayISO} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-muted" aria-hidden="true">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/** A core movement's page (v0.671): every day's longest hold or most reps,
 *  with changed days marked and the best circled; its numbers; recent days. */
export function CorePage({
  move: m,
  color,
  unit,
  marks,
  todayISO,
  onClose,
}: {
  move: CoreMove;
  color: string;
  unit: string;
  marks: { date: string; label: string }[];
  todayISO: string;
  onClose: () => void;
}) {
  const first = m.points[0];
  const last = m.points.at(-1);
  const trend = liftTrend(m.points, m.best, todayISO);
  const word = m.kind === "time" ? "s" : "reps";
  return (
    <Modal title={m.name} onClose={onClose}>
      <div className="space-y-4">
        <p className="-mt-2 text-sm font-semibold" style={{ color }}>
          Core · {m.kind === "time" ? "longest hold, seconds" : "most reps"}
        </p>
        <LineChart
          dots
          legend={false}
          series={[{ id: m.movement, name: m.name, color, unit: word, points: m.points.map((p) => ({ date: p.date, value: p.value })) }]}
          marks={marks.filter((x) => first && x.date >= first.date && x.date <= todayISO)}
          ring={m.best ? { date: m.best.date, value: m.best.value } : null}
        />
        <div className="grid grid-cols-2 gap-2">
          <Tile k="Best" v={m.best ? coreValueText(m.kind, m.best.value, m.best.weight, unit) : "\u2014"} sub={m.best ? formatShort(m.best.date) : ""} />
          <Tile
            k="30 days"
            v={trend?.kind === "up" ? `+${trend.delta} ${word}` : trend?.kind === "flat" ? "Flat" : "\u2014"}
            sub={trend?.kind === "up" ? "still climbing" : trend?.kind === "flat" ? "no gain" : "no older session"}
            tone={trend?.kind}
          />
          <Tile k="Sessions" v={`${m.points.length}`} sub={first ? `since ${formatShort(first.date)}` : ""} />
          <Tile k="Last" v={last ? coreValueText(m.kind, last.value, last.weight, unit) : "\u2014"} sub={last ? formatShort(last.date) : ""} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Recent sessions</p>
          <ul className="mt-1 divide-y divide-hairline text-sm">
            {m.points
              .slice(-5)
              .reverse()
              .map((p) => (
                <li key={p.date} className="flex justify-between py-2">
                  <span>{formatShort(p.date)}</span>
                  <span className="tabular text-muted">{coreValueText(m.kind, p.value, p.weight, unit)}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

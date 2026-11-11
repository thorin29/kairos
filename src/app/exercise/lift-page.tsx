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
import {
  GROUP_LABEL,
  coreGroupOf,
  moveChange,
  pctText,
  tagOf,
  tagText,
  type CoreSummary,
  type CoreTag,
} from "@/lib/workouts/core-progress";

const sorted = (pts: GraphSeries["points"]) => [...pts].sort((a, b) => (a.date < b.date ? -1 : 1));
const setText = (v: number, reps?: number | null) => `${v}${reps ? ` × ${reps}` : ""}`;

/** A small line of the top set per session, last 12 sessions. */
function Spark({ points, color }: { points: GraphSeries["points"]; color: string }) {
  const pts = sorted(points).slice(-12);
  // Nothing to draw takes no room (v0.672), so the name can use it.
  if (pts.length < 2) return null;
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
  if (!t) return null;
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

function Tile({ k, v, sub, tone, onClick }: { k: string; v: string; sub: string; tone?: "up" | "flat"; onClick?: () => void }) {
  const body = (
    <>
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted">{k}</span>
      <span
        className={`tabular mt-0.5 block text-lg font-semibold ${
          tone === "up" ? "text-emerald-700 dark:text-emerald-400" : tone === "flat" ? "text-amber-700 dark:text-amber-400" : ""
        }`}
      >
        {v}
      </span>
      <span className="block text-[11px] text-muted">{sub}</span>
    </>
  );
  const cls = "rounded-xl border border-hairline bg-ground/40 px-3 py-2 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition-colors hover:border-accent`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
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

const mmss = (sec: number) => coreValueText("time", sec, null, "");
const TAG_TONE: Record<CoreTag, string> = {
  up: "text-emerald-700 dark:text-emerald-400",
  flat: "text-amber-700 dark:text-amber-400",
  down: "text-red-700 dark:text-red-400",
  new: "text-muted",
};
const monthOf = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-muted" aria-hidden="true">
    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Core's progress line: the middle change across moves each week, with
 *  plank tests as rings when asked. Percent against each move's start. */
function CoreLine({
  series,
  tests,
  color,
  height,
  axis,
}: {
  series: CoreSummary["series"];
  tests?: CoreSummary["tests"];
  color: string;
  height: number;
  axis?: boolean;
}) {
  if (series.length === 0) return null;
  const W = 320;
  const left = axis ? 36 : 4;
  const top = 6;
  const bottom = height - 8;
  const vals = [0, ...series.map((p) => p.value), ...(tests ?? []).map((t) => t.value)];
  const lo = Math.min(...vals);
  const hi = Math.max(10, ...vals);
  const t0 = Date.parse(`${series[0].date}T12:00:00Z`);
  const t1 = Math.max(t0 + 86400000, Date.parse(`${series[series.length - 1].date}T12:00:00Z`) + 6 * 86400000);
  const X = (iso: string) => left + ((Date.parse(`${iso}T12:00:00Z`) - t0) / (t1 - t0)) * (W - left - 4);
  const Y = (v: number) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
  const line = series.map((p) => `${X(p.date).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
  const first = series[0];
  const last = series[series.length - 1];
  const step = hi - lo > 40 ? 20 : 10;
  const grid: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="block w-full" style={{ height }} aria-hidden>
      {axis &&
        grid.map((v) => (
          <g key={v}>
            <line x1={left} x2={W} y1={Y(v)} y2={Y(v)} className="stroke-hairline" strokeWidth={1} />
            <text x={0} y={Y(v) + 3} fontSize={10} className="fill-muted">
              {v === 0 ? "Start" : pctText(v)}
            </text>
          </g>
        ))}
      {!axis && <line x1={left} x2={W - 4} y1={Y(0)} y2={Y(0)} className="stroke-hairline" strokeDasharray="3 3" strokeWidth={1} />}
      <polygon points={`${X(first.date).toFixed(1)},${Y(Math.max(lo, 0))} ${line} ${X(last.date).toFixed(1)},${Y(Math.max(lo, 0))}`} fill={color} fillOpacity={0.14} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {!tests && <circle cx={X(last.date)} cy={Y(last.value)} r={4} fill={color} />}
      {(tests ?? []).map((t) => (
        <circle key={t.date} cx={X(t.date)} cy={Y(t.value)} r={4} className="fill-surface stroke-ink" strokeWidth={2} />
      ))}
    </svg>
  );
}

/**
 * Core on the Workouts page (v0.673; was a row per movement, v0.671): one
 * card that stays the same size however many core moves there are — the
 * core's progress against each move's start, its line, and the plank test,
 * core days this week and moves improving. Opens the Core page.
 */
export function CoreCard({ summary, color, onOpen }: { summary: CoreSummary; color: string; onOpen: () => void }) {
  const best = summary.plankBest;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open Core"
      className="mt-2 flex w-full flex-col gap-2.5 rounded-xl border border-hairline bg-surface p-3.5 text-left transition-colors hover:border-accent"
    >
      <span className="flex w-full items-start gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">Core progress</span>
          <span className="flex items-baseline gap-1.5">
            <span className={`tabular text-2xl font-bold ${summary.change != null ? TAG_TONE[tagOf(summary.change)] : ""}`}>
              {summary.change != null ? pctText(summary.change) : "\u2014"}
            </span>
            <span className="text-xs text-muted">
              {summary.since ? `since ${monthOf(summary.since)}` : ""} · {summary.recent} {summary.recent === 1 ? "move" : "moves"}
            </span>
          </span>
        </span>
        <span className="mt-1.5">
          <Chevron />
        </span>
      </span>
      <CoreLine series={summary.series} color={color} height={60} />
      <span className="grid w-full grid-cols-3 border-t border-hairline pt-2.5">
        <span className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Plank test</span>
          <span className="tabular text-[15px] font-semibold">{best ? mmss(best.seconds) : "\u2014"}</span>
          <span className="text-[11px] text-muted">{best?.pft != null ? `${best.pft} pts` : best ? "under 1:10" : "none yet"}</span>
        </span>
        <span className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">This week</span>
          <span className="tabular text-[15px] font-semibold">{summary.daysThisWeek}</span>
          <span className="text-[11px] text-muted">core {summary.daysThisWeek === 1 ? "day" : "days"}</span>
        </span>
        <span className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Improving</span>
          <span className="tabular text-[15px] font-semibold">
            {summary.improving} of {summary.recent}
          </span>
          <span className="text-[11px] text-muted">moves</span>
        </span>
      </span>
    </button>
  );
}

/**
 * The Core page (v0.673): the progress line with the plank tests, tiles, and
 * the moves done in the last eight weeks grouped by what they work, each
 * with its last result and whether it's up. Older moves are a tap away.
 * A move opens its own pop-up.
 */
export function CoreOverview({
  summary,
  moves,
  color,
  unit,
  onOpenMove,
  onOpenPlank,
  onClose,
}: {
  summary: CoreSummary;
  moves: CoreMove[];
  color: string;
  unit: string;
  onOpenMove: (m: CoreMove) => void;
  onOpenPlank: () => void;
  onClose: () => void;
}) {
  const [idleOpen, setIdleOpen] = useState(false);
  const [info, setInfo] = useState(false);
  const byId = new Map(moves.map((m) => [m.movement, m]));
  const best = summary.plankBest;
  const lastText = (m: CoreMove) => {
    const p = m.points.at(-1);
    return p ? coreValueText(m.kind, p.value, p.weight, unit) : "";
  };
  const months: string[] = [];
  for (const p of summary.series) {
    const mo = monthOf(p.date);
    if (months.at(-1) !== mo) months.push(mo);
  }
  return (
    <Modal title="Core" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-hairline p-3">
          <div className="flex items-center gap-1.5">
            <p className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Core progress</p>
            <button
              type="button"
              onClick={() => setInfo(true)}
              aria-label="About core progress"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-ground"
            >
              ⓘ
            </button>
          </div>
          <CoreLine series={summary.series} tests={summary.tests} color={color} height={150} axis />
          <div className="flex justify-between pl-9 text-[10px] text-muted">
            {months.map((m, i) => (
              <span key={`${m}-${i}`}>{m}</span>
            ))}
          </div>
          <div className="mt-2 flex gap-3.5 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-3.5 rounded" style={{ background: color }} />
              All moves
            </span>
            {summary.tests.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full border-2 border-ink" />
                Plank test
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Tile k="Plank test" v={best ? mmss(best.seconds) : "\u2014"} sub={best?.pft != null ? `${best.pft} pts` : "best"} onClick={onOpenPlank} />
          <Tile k="This month" v={`${summary.daysThisMonth}`} sub="core days" />
          <Tile k="New bests" v={`${summary.newBests30}`} sub="last 30 days" />
        </div>
        {summary.groups.map((g) => (
          <div key={g.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between px-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{g.label}</p>
              <p className={`text-xs font-semibold ${TAG_TONE[tagOf(g.change)]}`}>
                {g.change == null ? "" : tagOf(g.change) === "flat" ? "Flat" : pctText(g.change)}
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
              {g.moves.map((x, i) => {
                const m = byId.get(x.movement);
                if (!m) return null;
                return (
                  <button
                    key={x.movement}
                    type="button"
                    onClick={() => onOpenMove(m)}
                    className={`flex min-h-[52px] w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ground/50 ${i ? "border-t border-hairline" : ""}`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-2 text-sm font-semibold">{m.name}</span>
                      <span className="truncate text-xs text-muted">Last {lastText(m)}</span>
                    </span>
                    <span className={`shrink-0 text-xs font-semibold ${TAG_TONE[x.tag]}`}>{tagText(x.tag, x.change)}</span>
                    <Chevron />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {summary.idle.length > 0 && (
          <button
            type="button"
            onClick={() => setIdleOpen(true)}
            className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-hairline bg-surface px-3 text-sm"
          >
            <span className="font-medium">Not done lately</span>
            <span className="flex items-center gap-1 text-muted">
              {summary.idle.length} {summary.idle.length === 1 ? "move" : "moves"}
              <Chevron />
            </span>
          </button>
        )}
        {(summary.recentDays?.length ?? 0) > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Recent core days</p>
            <ul className="mt-1 divide-y divide-hairline text-sm">
              {summary.recentDays.map((d) => (
                <li key={d.date} className="flex justify-between gap-3 py-2">
                  <span className="shrink-0">{formatShort(d.date)}</span>
                  <span className="text-right text-muted">{d.moves.join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {idleOpen && (
        <Modal title="Not done lately" onClose={() => setIdleOpen(false)}>
          <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
            {summary.idle.map((id, i) => {
              const m = byId.get(id);
              if (!m) return null;
              const last = m.points.at(-1);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onOpenMove(m)}
                  className={`flex min-h-[52px] w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-ground/50 ${i ? "border-t border-hairline" : ""}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-sm font-semibold">{m.name}</span>
                    <span className="truncate text-xs text-muted">
                      Last {lastText(m)}
                      {last ? ` · ${formatShort(last.date)}` : ""}
                    </span>
                  </span>
                  <Chevron />
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {info && (
        <Modal title="Core progress" onClose={() => setInfo(false)}>
          <p className="text-sm">
            Each move is compared with its first session: a hold by its time, reps by reps, a weighted set by its
            estimated max. The line is the middle of those changes, so no one move counts more than another.
          </p>
        </Modal>
      )}
    </Modal>
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
  const word = m.kind === "time" ? "s" : "reps";
  const change = moveChange(m);
  return (
    <Modal title={m.name} onClose={onClose}>
      <div className="space-y-4">
        <p className="-mt-2 text-sm font-semibold" style={{ color }}>
          {GROUP_LABEL[coreGroupOf(m.name)]} · {m.points.length} {m.points.length === 1 ? "time" : "times"}
          {first ? ` since ${formatShort(first.date)}` : ""}
        </p>
        <LineChart
          dots
          legend={false}
          series={[{ id: m.movement, name: m.name, color, unit: word, points: m.points.map((p) => ({ date: p.date, value: p.value })) }]}
          marks={marks.filter((x) => first && x.date >= first.date && x.date <= todayISO)}
          ring={m.best ? { date: m.best.date, value: m.best.value } : null}
        />
        <div className="grid grid-cols-3 gap-2">
          <Tile k="Best" v={m.best ? coreValueText(m.kind, m.best.value, m.best.weight, unit) : "\u2014"} sub={m.best ? formatShort(m.best.date) : ""} />
          <Tile k="First" v={first ? coreValueText(m.kind, first.value, first.weight, unit) : "\u2014"} sub={first ? formatShort(first.date) : ""} />
          <Tile
            k="Change"
            v={change == null ? "\u2014" : pctText(change)}
            sub={last ? `last ${coreValueText(m.kind, last.value, last.weight, unit)}` : ""}
            tone={change == null ? undefined : tagOf(change) === "up" ? "up" : "flat"}
          />
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

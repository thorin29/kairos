"use client";

import { useEffect, useState } from "react";
import { InfoIcon } from "@/components/icons";
import type { NavRegion } from "@/lib/workouts/involvement";
import {
  DEFAULT_HEAT_RANGE,
  HEAT_RANGES,
  type HeatGroup,
  type HeatMap,
  type HeatRange,
  type HeatRangeKey,
  type PlankTest,
  PFT_PLANK_MAX_SEC,
  PFT_PLANK_MIN_SEC,
} from "@/lib/workouts/heat";
import { readPref, writePref } from "./conditioning-timer";
import { Modal } from "./plan-file-panel";
import type { TrainGroup, TrainingHeat } from "@/lib/workouts/training-heat";

/**
 * The body map's heat view (v0.635; v0.664 the training heat map: warmth by
 * consistency and progress, no ranges). The toggle is kept per device.
 */

const HEAT_ON_KEY = "kairos.heat.on";
const HEAT_RANGE_KEY = "kairos.heat.range";

export function useHeatPrefs() {
  const [on, setOnState] = useState(false);
  const [range, setRangeState] = useState<HeatRangeKey>(DEFAULT_HEAT_RANGE);
  // Read after mount so the server render and the first client render agree.
  useEffect(() => {
    setOnState(readPref(HEAT_ON_KEY, "0") === "1");
    const r = readPref(HEAT_RANGE_KEY, DEFAULT_HEAT_RANGE);
    if (HEAT_RANGES.some((x) => x.key === r)) setRangeState(r as HeatRangeKey);
  }, []);
  const setOn = (v: boolean) => {
    setOnState(v);
    writePref(HEAT_ON_KEY, v ? "1" : "0");
  };
  const setRange = (v: HeatRangeKey) => {
    setRangeState(v);
    writePref(HEAT_RANGE_KEY, v);
  };
  return { on, setOn, range, setRange };
}

/** The group a tap target stands for in the heat view. */
export const heatGroupOf = (nav: NavRegion) => (nav === "POSTERIOR_HIP" ? "DEADLIFT" : nav);

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function HeatBests({ bests, unit }: { bests: HeatGroup["bests"]; unit: string }) {
  if (bests.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {bests.map((b) => (
        <li key={b.name} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">
            {b.name}
            <span className="text-muted">
              {" · "}
              {b.kind === "weight" ? `${b.reps} reps` : b.kind === "time" ? "longest hold" : "most reps"}
            </span>
          </span>
          <span className="tabular shrink-0 font-medium">
            {b.kind === "time"
              ? b.from === b.to
                ? clock(b.to)
                : `${clock(b.from)} → ${clock(b.to)}`
              : b.from === b.to
                ? b.to
                : `${b.from} → ${b.to}`}
            {b.kind === "weight" && unit ? ` ${unit}` : ""}
            {b.pft != null ? <span className="text-muted"> · {b.pft} pts</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A muscle with no weight charts (a core of holds and reps): its hard sets
 *  a week over the last 12 weeks and its bests, then → now (v0.638). */
export function HeatGroupSummary({ data, unit }: { data: HeatGroup | undefined; unit: string }) {
  if (!data || (data.perWeek === 0 && data.bests.length === 0)) {
    return <p className="mt-2 text-sm text-muted">Nothing logged yet.</p>;
  }
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-hairline bg-ground/40 px-3 py-2.5 text-sm">
      <p className="text-muted">
        <span className="tabular font-semibold text-ink">{fmt(data.perWeek)}</span> hard sets a week · last 12 weeks
      </p>
      <HeatBests bests={data.bests} unit={unit} />
    </div>
  );
}

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const daysSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(`${iso}T12:00:00`)) / 86_400_000));

function Tile({ k, v, unit, sub, up }: { k: string; v: string; unit?: string; sub: string; up?: boolean }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k}</p>
      <p className={`tabular font-display text-xl font-semibold leading-tight ${up ? "text-emerald-600" : ""}`}>
        {v}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>}
      </p>
      <p className="truncate text-xs text-muted">{sub}</p>
    </div>
  );
}

/**
 * Core's benchmark (v0.643): the plank test — the Marine Corps PFT plank,
 * a day's longest plank hold. Best and latest with their PFT points, the
 * change since the test before, and every test on a chart against the PFT's
 * pass (1:10) and full marks (3:45).
 */
export function PlankBench({ tests }: { tests: PlankTest[] }) {
  if (tests.length === 0)
    return (
      <div className="mt-2 rounded-xl border border-hairline bg-ground/40 px-3 py-2.5">
        <p className="text-sm font-semibold">Plank test</p>
        <p className="text-sm text-muted">No plank logged yet.</p>
      </div>
    );
  const best = tests.reduce((a, b) => (b.seconds > a.seconds ? b : a));
  const last = tests[tests.length - 1];
  const prev = tests.length > 1 ? tests[tests.length - 2] : null;
  const change = prev ? last.seconds - prev.seconds : null;
  const toMax = Math.max(0, PFT_PLANK_MAX_SEC - best.seconds);
  const pts = (t: PlankTest) => (t.pft != null ? `${t.pft} pts` : "under 1:10");

  // The chart: time against date, with the pass and full-marks lines.
  const W = 300;
  const H = 120;
  const pad = { l: 34, r: 8, t: 8, b: 18 };
  const t0 = Date.parse(tests[0].date);
  const t1 = Date.parse(last.date);
  const top = Math.max(PFT_PLANK_MAX_SEC, ...tests.map((t) => t.seconds)) * 1.05;
  const x = (d: string) =>
    tests.length === 1 || t1 === t0 ? (pad.l + W - pad.r) / 2 : pad.l + ((Date.parse(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (sec: number) => pad.t + (1 - sec / top) * (H - pad.t - pad.b);
  const line = tests.map((t, i) => `${i ? "L" : "M"}${x(t.date).toFixed(1)},${y(t.seconds).toFixed(1)}`).join(" ");

  return (
    <div className="mt-2 rounded-xl border border-hairline bg-ground/40 px-3 py-2.5">
      <p className="mb-2 text-sm font-semibold">Plank test</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile k="best" v={clock(best.seconds)} sub={`${pts(best)} · ${shortDate(best.date)}`} />
        <Tile k="last" v={clock(last.seconds)} sub={`${pts(last)} · ${shortDate(last.date)}`} />
        <Tile
          k="change"
          v={change == null ? "\u2014" : `${change >= 0 ? "+" : "\u2212"}${clock(Math.abs(change))}`}
          sub={change == null ? "first test" : "since the test before"}
          up={change != null && change > 0}
        />
        <Tile k="to 100 pts" v={toMax === 0 ? "Done" : clock(toMax)} sub={toMax === 0 ? "3:45 reached" : "more than your best"} />
        <Tile k="since best" v={`${daysSince(best.date)}`} unit="days" sub="last record" />
        <Tile k="tests" v={`${tests.length}`} sub={`since ${shortDate(tests[0].date)}`} />
      </div>
      {tests.length > 1 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Plank tests over time">
          {[
            [PFT_PLANK_MIN_SEC, "1:10"],
            [PFT_PLANK_MAX_SEC, "3:45"],
          ].map(([sec, label]) => (
            <g key={label}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y(sec as number)}
                y2={y(sec as number)}
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeDasharray="3 3"
              />
              <text x={pad.l - 4} y={y(sec as number) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity={0.6}>
                {label}
              </text>
            </g>
          ))}
          <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
          {tests.map((t) => (
            <circle key={t.date} cx={x(t.date)} cy={y(t.seconds)} r={3} fill="var(--color-accent)">
              <title>{`${shortDate(t.date)}: ${clock(t.seconds)} · ${pts(t)}`}</title>
            </circle>
          ))}
          <text x={pad.l} y={H - 4} fontSize="9" fill="currentColor" opacity={0.6}>
            {shortDate(tests[0].date)}
          </text>
          <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize="9" fill="currentColor" opacity={0.6}>
            {shortDate(last.date)}
          </text>
        </svg>
      )}
    </div>
  );
}

export function rangeOf(heat: HeatMap | undefined, key: HeatRangeKey): HeatRange | undefined {
  return heat?.ranges.find((r) => r.key === key);
}

// --- the training heat map (v0.664) ------------------------------------------

/** Warmth 1–5, pale yellow to red; −1 to −3, light to deep blue. The same on
 *  every theme. Neutral (0) is the figure's own grey. */
export const TRAIN_WARM = ["#fde68a", "#facc15", "#fb923c", "#ea580c", "#dc2626"] as const;
export const TRAIN_COLD = ["#bfdbfe", "#60a5fa", "#2563eb"] as const;
export const trainColor = (level: number): string | null =>
  level > 0 ? TRAIN_WARM[Math.min(5, level) - 1] : level < 0 ? TRAIN_COLD[Math.min(3, -level) - 1] : null;

export function trainFills(t: TrainingHeat | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of t?.groups ?? []) {
    const c = trainColor(g.level);
    if (c) out[g.group] = c;
  }
  return out;
}

/** Every group that has a story (trained at some point) can be tapped. */
export function trainAvailable(t: TrainingHeat | undefined): NavRegion[] {
  return (t?.groups ?? []).map((g) => (g.group === "DEADLIFT" ? "POSTERIOR_HIP" : (g.group as NavRegion)));
}

export function TrainKey() {
  const [about, setAbout] = useState(false);
  const sw = (c: string, k: string) => <span key={k} className="h-3 w-4 rounded-sm" style={{ background: c }} />;
  return (
    <div className="flex items-center justify-center gap-1 text-xs text-muted">
      <span className="mr-1">cooled</span>
      {[...TRAIN_COLD].reverse().map((c) => sw(c, c))}
      {sw("var(--color-figure)", "n")}
      {TRAIN_WARM.map((c) => sw(c, c))}
      <span className="ml-1">hot</span>
      <button
        type="button"
        onClick={() => setAbout(true)}
        aria-label="About the heat map"
        className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-accent"
      >
        <InfoIcon className="h-4 w-4" />
      </button>
      {about && (
        <Modal title="Heat map" onClose={() => setAbout(false)}>
          <div className="space-y-2 text-sm">
            <p>Each muscle warms a step for every week you give it real work, and fastest when you&apos;re coming back to where you were.</p>
            <p>The hottest step is for training it steadily and setting a new best in the last six weeks.</p>
            <p>A missed week cools it a step. It only turns blue after it&apos;s cooled to grey and you&apos;ve missed it about a month.</p>
            <p>
              Strength that keeps slipping for two weeks cools it too. Light, deload and test weeks, adjusted days, and
              your first session back aren&apos;t judged.
            </p>
            <p>The heart is endurance: sport, rowing, running, rucking and conditioning, by minutes and how hard they felt.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** The endurance gauge: a heart in the same colours. */
export function EnduranceHeart({ data, onOpen }: { data: TrainGroup | null; onOpen: () => void }) {
  const c = data ? (trainColor(data.level) ?? "var(--color-figure)") : "var(--color-figure)";
  return (
    <button type="button" onClick={onOpen} className="flex flex-col items-center gap-0.5 text-[11px] text-muted" aria-label="Endurance">
      <svg viewBox="0 0 24 22" className="h-9 w-9" aria-hidden>
        <path
          d="M12 21s-8.5-5.4-10.6-10.3C-0.2 6.7 2.3 2 6.6 2c2.2 0 3.9 1.2 5.4 3 1.5-1.8 3.2-3 5.4-3C21.7 2 24.2 6.7 22.6 10.7 20.5 15.6 12 21 12 21z"
          fill={c}
        />
      </svg>
      Endurance
    </button>
  );
}

/** A tapped muscle (or the heart): this week — exact sets or minutes, and a
 *  row per movement or kind (v0.673). With nothing this week, why it's this
 *  colour instead. */
export function TrainDetail({
  title,
  data,
  onClose,
}: {
  title: string;
  data: TrainGroup | null | undefined;
  onClose: () => void;
}) {
  const week = data?.week;
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2 text-base font-semibold">
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ background: (data && trainColor(data.level)) ?? "var(--color-figure)" }}
          />
          {week?.headline ?? data?.line ?? "Nothing logged yet."}
        </p>
        {week && week.rows.length === 0 && data?.line && <p className="text-muted">{data.line}</p>}
        {week && week.rows.length > 0 && (
          <ul className="divide-y divide-hairline border-t border-hairline">
            {week.rows.map((r) => (
              <li key={r.name} className="flex items-baseline gap-2.5 py-2">
                <span className="h-1.5 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-muted" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-xs text-muted">{r.detail}</span>
                </span>
                <span className="tabular shrink-0 font-semibold">{r.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

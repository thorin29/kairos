"use client";

import { useState } from "react";
import { Modal } from "./plan-file-panel";
import { ChartTip, useChartTip } from "@/components/chart-tip";
import { BackpackIcon, BikeIcon, HeartIcon, HikeIcon, HockeyIcon, JumpRopeIcon, RowIcon, RunIcon, WalkIcon } from "@/components/icons";
import {
  clock,
  hoursText,
  split,
  type CardioActivity,
  type CardioActivityKey,
  type CardioCharts,
  type ConditioningCharts,
  type ConditioningRepeat,
} from "@/lib/workouts/endurance-charts";

/** The weekly-training colours (v0.672), so a kind reads the same everywhere. */
// v0.686: the same colours as Weekly training's Cardio and Conditioning,
// which no muscle group uses.
export const CARDIO_COLOR = "#0ea5e9";
export const CONDITIONING_COLOR = "#c026d3";
const EFFORT_SHADE: Record<string, string> = { EASY: "#9fd9f6", SOLID: "#0ea5e9", HARD: "#075985", TOO_HARD: "#075985" };

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const md = (iso: string) => `${MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const dayLong = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(1));

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-muted" aria-hidden="true">
    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Tile({ k, v, sub, tone }: { k: string; v: string; sub: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{k}</p>
      <p
        className={`tabular mt-0.5 text-lg font-semibold ${
          tone === "up" ? "text-emerald-700 dark:text-emerald-400" : tone === "down" ? "text-amber-700 dark:text-amber-400" : ""
        }`}
      >
        {v}
      </p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}

/** Twelve weekly bars with dates under them. With `tip` (on a page, not a
 *  card, which is one big button) each week shows its number on hover or tap (v0.693). */
function WeekBars({
  values,
  starts,
  color,
  height,
  label,
  tip,
  parts,
}: {
  values: number[];
  starts: string[];
  color: string;
  height: number;
  label: string;
  tip?: (v: number) => string;
  /** Each week split by kind (v0.745), bottom first; white lines between. */
  parts?: { minutes: number; color: string }[][];
}) {
  const max = Math.max(1, ...values);
  const { wrap, tip: shown, show, hide } = useChartTip();
  return (
    <div ref={wrap} className="relative">
      <div className="flex items-end gap-1 border-b border-hairline" style={{ height }} role="img" aria-label={label}>
        {values.map((v, i) =>
          tip ? (
            // The whole column is the target, so an empty week can be pointed at too.
            <span
              key={starts[i]}
              data-tip=""
              aria-label={`${tip(v)}, week of ${md(starts[i])}`}
              className="flex h-full flex-1 cursor-pointer items-end"
              onPointerEnter={(e) => show(e.currentTarget.firstElementChild ?? e.currentTarget, tip(v), `Week of ${md(starts[i])}`)}
              onPointerLeave={(e) => {
                if (e.pointerType !== "touch") hide();
              }}
            >
              <span className="block w-full rounded-t-[3px]" style={{ height: `${(v / max) * 100}%`, background: color, minHeight: v > 0 ? 2 : 0 }} />
            </span>
          ) : parts?.[i]?.length ? (
            <span key={starts[i]} className="flex flex-1 flex-col-reverse overflow-hidden rounded-t-[3px]" style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}>
              {parts[i].map((p, j) => (
                <span key={j} className={j > 0 ? "border-b border-white" : undefined} style={{ flexGrow: p.minutes, flexBasis: 0, background: p.color }} />
              ))}
            </span>
          ) : (
            <span key={starts[i]} className="block flex-1 rounded-t-[3px]" style={{ height: `${(v / max) * 100}%`, background: color, minHeight: v > 0 ? 2 : 0 }} />
          ),
        )}
      </div>
      <ChartTip tip={shown} />
      <div className="tabular mt-1 flex justify-between text-[10px] text-muted">
        {[0, 4, 8].map((i) => (starts[i] ? <span key={i}>{md(starts[i])}</span> : null))}
        <span>This week</span>
      </div>
    </div>
  );
}

// --- cardio ------------------------------------------------------------------

/**
 * Cardio on the Workouts page (v0.674): this week's minutes and a line per
 * activity, with twelve weeks of minutes. Opens the Cardio page.
 */
export function CardioCard({ data, onOpen }: { data: CardioCharts; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open Cardio"
      className="mt-2 flex w-full flex-col gap-2.5 rounded-xl border border-hairline bg-surface p-3.5 text-left transition-colors hover:border-accent"
    >
      <span className="flex w-full items-start gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">This week</span>
          <span className="tabular text-2xl font-bold">{data.thisWeek.minutes} min</span>
          {data.thisWeek.lines.length > 0 ? (
            data.thisWeek.lines.map((l) => (
              <span key={l.key} className="flex items-center gap-1.5 text-xs text-muted">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: l.color }} />
                <span>
                  <span className="font-semibold text-ink">{l.label}</span> · {l.detail}
                </span>
              </span>
            ))
          ) : data.last ? (
            <span className="text-xs text-muted">
              Last: {data.last.label} · {dayLong(data.last.date)}
            </span>
          ) : null}
        </span>
        <span className="mt-1.5">
          <Chevron />
        </span>
      </span>
      <span className="block w-full">
        <WeekBars
          values={data.weeks.map((w) => w.minutes)}
          starts={data.weeks.map((w) => w.start)}
          color={CARDIO_COLOR}
          parts={data.weeks.map((w) => w.parts)}
          height={48}
          label="Cardio minutes per week"
        />
      </span>
    </button>
  );
}

/** Pace per session: faster is higher, shaded by how it felt, the best ringed. */
function PaceChart({ a }: { a: CardioActivity }) {
  const { wrap, tip, markProps } = useChartTip();
  const p = a.pace!;
  const W = 334;
  const H = 170;
  const left = 44;
  const secs = p.points.map((x) => x.sec);
  const lo = Math.min(...secs);
  const hi = Math.max(...secs);
  const pad = Math.max(2, (hi - lo) * 0.12);
  const a0 = lo - pad;
  const a1 = hi + pad;
  const Y = (s: number) => 12 + ((s - a0) / (a1 - a0)) * (H - 24);
  const n = p.points.length;
  const X = (i: number) => (n === 1 ? (left + W) / 2 : left + 8 + i * ((W - left - 16) / (n - 1)));
  const fmt = (s: number) => (a.measure === "m" ? split(s) : clock(s));
  const ticks = [a0 + (a1 - a0) * 0.2, (a0 + a1) / 2, a0 + (a1 - a0) * 0.8];
  const bi = p.best ? p.points.findIndex((x) => x.date === p.best!.date && Math.abs(x.sec - p.best!.sec) < 0.05) : -1;
  const felt: Record<string, string> = { EASY: "Easy", SOLID: "Solid", HARD: "Hard", TOO_HARD: "Too hard" };
  const tipOf = (x: (typeof p.points)[number]): [string, string] => [
    a.measure === "m" ? `${split(x.sec)} /500 m` : `${clock(x.sec)} /${p.per}`,
    `${md(x.date)}${x.effort && felt[x.effort] ? ` · ${felt[x.effort]}` : ""}`,
  ];
  return (
    <div ref={wrap} className="relative">
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Pace per ${p.per}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W} y1={Y(t)} y2={Y(t)} className="stroke-hairline" />
          <text x={left - 6} y={Y(t) + 3} fontSize={10} textAnchor="end" className="fill-muted">
            {a.measure === "m" ? split(t).replace(/\.\d$/, "") : clock(t)}
          </text>
        </g>
      ))}
      {p.points.map((x, i) => (
        <circle key={`${x.date}-${i}`} cx={X(i)} cy={Y(x.sec)} r={4.5} fill={EFFORT_SHADE[x.effort ?? ""] ?? "#c9ced6"} className="stroke-surface" strokeWidth={1.5} />
      ))}
      {bi >= 0 && (
        <g>
          <circle cx={X(bi)} cy={Y(p.points[bi].sec)} r={8.5} fill="none" className="stroke-ink" strokeWidth={1.5} />
          <text x={X(bi)} y={Y(p.points[bi].sec) - 13} fontSize={10} fontWeight={600} textAnchor="middle" className="fill-ink">
            {fmt(p.points[bi].sec)}
          </text>
        </g>
      )}
      {/* Hover and tap targets last, over the ring (v0.693). */}
      {p.points.map((x, i) => (
        <circle key={`t${x.date}-${i}`} cx={X(i)} cy={Y(x.sec)} r={10} fill="transparent" className="cursor-pointer" {...markProps(...tipOf(x))} />
      ))}
    </svg>
    <ChartTip tip={tip} />
    </div>
  );
}

/**
 * The Cardio page (v0.674): an activity at a time — its pace per session
 * (or minutes for other cardio), then its numbers, distance per week and
 * recent sessions. The same order as a lift's page.
 */
export function CardioPage({ data, onClose }: { data: CardioCharts; onClose: () => void }) {
  const ordered = orderActivities(data.activities);
  const [pick, setPick] = useState(ordered.all[0]?.key);
  const a = data.activities.find((x) => x.key === pick) ?? ordered.all[0];
  if (!a) return null;
  const per = a.pace?.per;
  const unitWord = a.measure === "min" ? "min" : a.measure;
  const volTitle = a.measure === "m" ? "Meters per week" : a.measure === "min" ? "Minutes per week" : a.measure === "km" ? "Kilometers per week" : "Miles per week";
  const change = a.pace?.change;
  return (
    <Modal title="Cardio" onClose={onClose}>
      <div className="space-y-4">
        {data.activities.length > 1 && <ActivityPicker ordered={ordered} value={a.key} onPick={setPick} />}
        {a.pace && a.pace.points.length > 0 ? (
          <div className="rounded-xl border border-hairline bg-surface p-3">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{a.measure === "m" ? "Split per 500 m" : `Pace per ${per}`}</p>
              <span className="text-[11px] text-muted">Faster is higher</span>
            </div>
            <PaceChart a={a} />
            <div className="flex flex-wrap gap-3 text-[11px] text-muted">
              {[
                ["Easy", EFFORT_SHADE.EASY],
                ["Solid", EFFORT_SHADE.SOLID],
                ["Hard", EFFORT_SHADE.HARD],
              ].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                  {l}
                </span>
              ))}
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-ink" />
                Best
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-hairline bg-surface p-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{volTitle}</p>
            <div className="mt-2">
              <WeekBars values={a.weeks.map((w) => w.value)} starts={a.weeks.map((w) => w.start)} color={a.color} height={90} label={volTitle} tip={(v) => (a.measure === "min" ? `${num(v)} min` : `${num(v)} ${unitWord}`)} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Tile
            k="This week"
            v={a.measure === "min" ? `${a.thisWeek.minutes} min` : `${num(a.thisWeek.value)} ${unitWord}`}
            sub={`${a.thisWeek.count} ${a.thisWeek.count === 1 ? "session" : "sessions"}${a.measure === "min" ? "" : ` · ${a.thisWeek.minutes} min`}`}
          />
          {a.pace ? (
            <Tile
              k={a.measure === "m" ? "Best split" : "Best pace"}
              v={a.pace.best ? (a.measure === "m" ? split(a.pace.best.sec) : clock(a.pace.best.sec)) : "—"}
              sub={a.pace.best ? md(a.pace.best.date) : a.measure === "m" ? "rows of 1,000 m+" : "a mile or more"}
            />
          ) : (
            <Tile k="Longest" v={a.longest ? `${a.longest.minutes} min` : "—"} sub={a.longest ? md(a.longest.date) : ""} />
          )}
          {a.pace ? (
            <Tile
              k={a.measure === "m" ? "Split, 30 d" : "Pace, 30 d"}
              v={change == null ? "—" : change === 0 ? "Same" : `${change < 0 ? "−" : "+"}${Math.abs(change)} s`}
              sub={change == null ? "needs 2 months" : `per ${per}`}
              tone={change == null || change === 0 ? undefined : change < 0 ? "up" : "down"}
            />
          ) : (
            <Tile k="30 days" v={`${a.sessions30}`} sub={a.sessions30 === 1 ? "session" : "sessions"} />
          )}
          <Tile
            k="Since best"
            v={a.sinceBestWeeks == null ? "\u2014" : a.sinceBestWeeks < 1 ? "This week" : `${a.sinceBestWeeks} ${a.sinceBestWeeks === 1 ? "week" : "weeks"}`}
            sub={a.pace?.best ? md(a.pace.best.date) : a.longest ? md(a.longest.date) : ""}
          />
          <Tile k="Sessions" v={`${a.count}`} sub={`since ${md(a.firstDate)}`} />
          <Tile k="Last" v={a.last.text.replace(/ \/.*$/, "")} sub={md(a.last.date)} />
        </div>
        {a.pace && (
          <div className="rounded-xl border border-hairline bg-surface p-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{volTitle}</p>
            <div className="mt-2">
              <WeekBars values={a.weeks.map((w) => w.value)} starts={a.weeks.map((w) => w.start)} color={a.color} height={90} label={volTitle} tip={(v) => (a.measure === "min" ? `${num(v)} min` : `${num(v)} ${unitWord}`)} />
            </div>
          </div>
        )}
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Recent sessions</p>
          <ul className="mt-1 divide-y divide-hairline text-sm">
            {a.recent.map((r, i) => (
              <li key={`${r.date}-${i}`} className="flex justify-between gap-3 py-2">
                <span className="shrink-0">{dayLong(r.date)}</span>
                <span className="tabular text-right text-muted">{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

// --- conditioning ------------------------------------------------------------

/**
 * Conditioning on the Workouts page (v0.674): this month's sessions and
 * time, new bests, and twelve weeks of sessions. Opens the Conditioning page.
 */
export function ConditioningCard({ data, onOpen }: { data: ConditioningCharts; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open Conditioning"
      className="mt-2 flex w-full flex-col gap-2.5 rounded-xl border border-hairline bg-surface p-3.5 text-left transition-colors hover:border-accent"
    >
      <span className="flex w-full items-start gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">This month</span>
          <span className="flex items-baseline gap-1.5">
            <span className="tabular text-2xl font-bold">{data.month.count}</span>
            <span className="text-xs text-muted">
              {data.month.count === 1 ? "session" : "sessions"} · {hoursText(data.month.minutes)}
            </span>
          </span>
          <span className="text-xs text-muted">
            {data.newBests30 > 0
              ? `${data.newBests30} new ${data.newBests30 === 1 ? "best" : "bests"} in the last 30 days`
              : `${data.repeats.length} ${data.repeats.length === 1 ? "workout" : "workouts"} done more than once`}
          </span>
        </span>
        <span className="mt-1.5">
          <Chevron />
        </span>
      </span>
      <span className="block w-full">
        <WeekBars values={data.weeks.map((w) => w.count)} starts={data.weeks.map((w) => w.start)} color={CONDITIONING_COLOR} height={48} label="Conditioning sessions per week" />
      </span>
    </button>
  );
}

/** Each attempt as a dot, better higher; the best darker, in conditioning's
 *  colour (v0.693, was the old amber). `tips` on the workout's page only. */
function Dots({ r, w = 80, h = 30, tips = false }: { r: ConditioningRepeat; w?: number; h?: number; tips?: boolean }) {
  const { wrap, tip, markProps } = useChartTip();
  const vals = r.results.map((x) => x.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const n = r.results.length;
  const score = (v: number) => (hi === lo ? 0.5 : r.timed ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo));
  const cx = (i: number) => (n === 1 ? w / 2 : 6 + i * ((w - 12) / (n - 1)));
  const cy = (v: number) => h - 4 - score(v) * (h - 8);
  const svg = (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      {r.results.map((x, i) => (
        <circle key={`${x.date}-${i}`} cx={cx(i)} cy={cy(x.value)} r={x.best ? 4.5 : 3.5} fill={x.best ? CONDITIONING_COLOR : "#f0abfc"} />
      ))}
      {tips &&
        r.results.map((x, i) => (
          <circle
            key={`t${x.date}-${i}`}
            cx={cx(i)}
            cy={cy(x.value)}
            r={10}
            fill="transparent"
            className="cursor-pointer"
            {...markProps(x.text, `${md(x.date)}${x.best ? " · best" : ""}`)}
          />
        ))}
    </svg>
  );
  if (!tips) return svg;
  return (
    <div ref={wrap} className="relative">
      {svg}
      <ChartTip tip={tip} />
    </div>
  );
}

/**
 * The Conditioning page (v0.674): sessions per week, then the numbers, then
 * the workouts done more than once (each attempt a dot) and how many were
 * done once. A workout opens its attempts.
 */
export function ConditioningPage({ data, onClose }: { data: ConditioningCharts; onClose: () => void }) {
  const [open, setOpen] = useState<ConditioningRepeat | null>(null);
  const [onceOpen, setOnceOpen] = useState(false);
  return (
    <Modal title="Conditioning" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Sessions per week</p>
          <div className="mt-2">
            <WeekBars values={data.weeks.map((w) => w.count)} starts={data.weeks.map((w) => w.start)} color={CONDITIONING_COLOR} height={70} label="Sessions per week" tip={(v) => (v === 1 ? "1 session" : `${v} sessions`)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Tile k="This month" v={`${data.month.count}`} sub={data.month.count === 1 ? "session" : "sessions"} />
          <Tile k="New bests" v={`${data.newBests30}`} sub="last 30 days" tone={data.newBests30 > 0 ? "up" : undefined} />
          <Tile k="Time spent" v={hoursText(data.month.minutes)} sub="this month" />
        </div>
        {data.repeats.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Done more than once</p>
            <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
              {data.repeats.map((r, i) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setOpen(r)}
                  className={`flex min-h-[60px] w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ground/50 ${i ? "border-t border-hairline" : ""}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-sm font-semibold">{r.name}</span>
                    <span className="truncate text-xs text-muted">
                      {r.kind ? `${r.kind} · ` : ""}
                      {r.results.length} times
                    </span>
                  </span>
                  <Dots r={r} />
                  <span className="flex w-[72px] shrink-0 flex-col items-end text-right">
                    <span className="tabular text-sm font-semibold">{r.last}</span>
                    <span className={`text-[11px] font-semibold ${r.newBest ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}`}>
                      {r.newBest ? "New best" : `Best ${r.best}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {data.once.length > 0 && (
          <button
            type="button"
            onClick={() => setOnceOpen(true)}
            className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-hairline bg-surface px-3 text-sm"
          >
            <span className="font-medium">Done once</span>
            <span className="flex items-center gap-1 text-muted">
              {data.once.length} {data.once.length === 1 ? "workout" : "workouts"}
              <Chevron />
            </span>
          </button>
        )}
        {(data.recent?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-hairline bg-surface p-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Recent sessions</p>
            <ul className="mt-1 divide-y divide-hairline text-sm">
              {data.recent.map((r, i) => (
                <li key={`${r.date}-${i}`} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block text-xs text-muted">{dayLong(r.date)}</span>
                  </span>
                  <span className="tabular shrink-0 text-muted">{r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <p className="-mt-2 text-sm text-muted">
            {open.kind ? `${open.kind} · ` : ""}
            {open.timed ? "faster is better" : "more is better"}
          </p>
          <div className="flex justify-center rounded-xl border border-hairline bg-surface p-3">
            <Dots r={open} w={300} h={90} tips />
          </div>
          <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface px-3 text-sm">
            {[...open.results].reverse().map((x, i) => (
              <li key={`${x.date}-${i}`} className="flex justify-between py-2">
                <span>{dayLong(x.date)}</span>
                <span className="tabular font-semibold">
                  {x.text}
                  {x.best ? " · best" : ""}
                </span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {onceOpen && (
        <Modal small title="Done once" onClose={() => setOnceOpen(false)}>
          <ul className="divide-y divide-hairline text-sm">
            {data.once.map((x, i) => (
              <li key={`${x.name}-${i}`} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block font-semibold">{x.name}</span>
                  <span className="block text-xs text-muted">{dayLong(x.date)}</span>
                </span>
                <span className="tabular shrink-0 text-muted">{x.text}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </Modal>
  );
}

const ACT_ICON: Record<CardioActivityKey, typeof RowIcon> = {
  ROWING: RowIcon,
  RUNNING: RunIcon,
  RUCKING: BackpackIcon,
  HIKING: HikeIcon,
  WALKING: WalkIcon,
  CYCLING: BikeIcon,
  JUMP_ROPE: JumpRopeIcon,
  CARDIO: HeartIcon,
  SPORT: HockeyIcon,
};

/**
 * The Cardio page's activities in order (v0.814): the ones done in the
 * chart's twelve weeks, most recent first, then the older ones. Up to five
 * recent ones are buttons; past that (or with any older one) four buttons and
 * More, which opens over the page with the rest.
 */
function orderActivities(list: readonly CardioActivity[]) {
  const from = list[0]?.weeks[0]?.start ?? "";
  const byLast = (x: CardioActivity, y: CardioActivity) => (x.last.date < y.last.date ? 1 : -1);
  const recent = list.filter((x) => x.last.date >= from).sort(byLast);
  const older = list.filter((x) => x.last.date < from).sort(byLast);
  const allFit = older.length === 0 && recent.length <= 5;
  const shown = allFit ? recent : recent.slice(0, 4);
  return { all: [...recent, ...older], shown, moreRecent: allFit ? [] : recent.slice(4), older };
}

function agoText(a: CardioActivity, today: string): string {
  const weeks = Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${a.last.date}T12:00:00Z`)) / (7 * 86_400_000));
  return weeks <= 0 ? "This week" : weeks === 1 ? "1 wk ago" : `${weeks} wk ago`;
}

function ActivityPicker({ ordered, value, onPick }: { ordered: ReturnType<typeof orderActivities>; value: CardioActivityKey; onPick: (k: CardioActivityKey) => void }) {
  const [open, setOpen] = useState(false);
  const extra = [...ordered.moreRecent, ...ordered.older];
  const pickedExtra = extra.find((x) => x.key === value);
  const thisYear = new Date().getFullYear();
  const today = new Date().toLocaleDateString("en-CA");
  const seg = (on: boolean) =>
    `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[9px] px-1 pb-1 pt-1.5 text-[11px] font-semibold ${on ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`;
  const row = (x: CardioActivity, sub: string) => {
    const Icon = ACT_ICON[x.key];
    return (
      <button
        key={x.key}
        type="button"
        role="menuitemradio"
        aria-checked={x.key === value}
        onClick={() => {
          onPick(x.key);
          setOpen(false);
        }}
        className={`flex min-h-[44px] w-full items-center gap-2.5 border-t border-hairline px-3 text-left text-sm hover:bg-ground ${x.key === value ? "font-semibold" : ""}`}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate">{x.label}</span>
        <span className="text-xs text-muted">{sub}</span>
      </button>
    );
  };
  return (
    <div className="relative">
      <div className="flex gap-[3px] rounded-xl bg-ground p-[3px]" role="group" aria-label="Activity">
        {ordered.shown.map((x) => {
          const Icon = ACT_ICON[x.key];
          return (
            <button key={x.key} type="button" aria-pressed={x.key === value} onClick={() => onPick(x.key)} className={seg(x.key === value)}>
              <Icon className={`h-[18px] w-[18px] ${x.key === value ? "text-accent" : ""}`} />
              <span className="max-w-full truncate">{x.label}</span>
            </button>
          );
        })}
        {extra.length > 0 && (
          <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={seg(!!pickedExtra)}>
            {pickedExtra ? (
              (() => {
                const Icon = ACT_ICON[pickedExtra.key];
                return <Icon className="h-[18px] w-[18px] text-accent" />;
              })()
            ) : (
              <span className="flex h-[18px] items-center text-base leading-none">···</span>
            )}
            <span className="max-w-full truncate">{pickedExtra ? `${pickedExtra.label} ▾` : "More ▾"}</span>
          </button>
        )}
      </div>
      {open && (
        <>
          {/* Opens over the page (v0.814), not pushing it down. */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-hairline bg-surface shadow-lg">
            {ordered.moreRecent.length > 0 && (
              <>
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Last 12 weeks</p>
                {ordered.moreRecent.map((x) => row(x, agoText(x, today)))}
              </>
            )}
            {ordered.older.length > 0 && (
              <>
                <p className={`px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted ${ordered.moreRecent.length ? "border-t border-hairline" : ""}`}>Older</p>
                {ordered.older.map((x) => row(x, Number(x.last.date.slice(0, 4)) === thisYear ? MONTH[Number(x.last.date.slice(5, 7)) - 1] : `${MONTH[Number(x.last.date.slice(5, 7)) - 1]} ${x.last.date.slice(0, 4)}`))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

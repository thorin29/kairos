"use client";

import { useState } from "react";
import { Modal } from "./plan-file-panel";
import { ChartTip, useChartTip } from "@/components/chart-tip";
import {
  clock,
  hoursText,
  split,
  type CardioActivity,
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
    <div className="rounded-xl border border-hairline bg-ground/40 px-3 py-2">
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
}: {
  values: number[];
  starts: string[];
  color: string;
  height: number;
  label: string;
  tip?: (v: number) => string;
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
              <span key={l.label} className="text-xs text-muted">
                <span className="font-semibold text-ink">{l.label}</span> · {l.detail}
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
        <WeekBars values={data.weeks.map((w) => w.minutes)} starts={data.weeks.map((w) => w.start)} color={CARDIO_COLOR} height={48} label="Cardio minutes per week" />
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
  const [pick, setPick] = useState(data.activities[0]?.key);
  const a = data.activities.find((x) => x.key === pick) ?? data.activities[0];
  if (!a) return null;
  const per = a.pace?.per;
  const unitWord = a.measure === "min" ? "min" : a.measure;
  const volTitle = a.measure === "m" ? "Meters per week" : a.measure === "min" ? "Minutes per week" : a.measure === "km" ? "Kilometers per week" : "Miles per week";
  const change = a.pace?.change;
  return (
    <Modal title="Cardio" onClose={onClose}>
      <div className="space-y-4">
        {data.activities.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Activity">
            {data.activities.map((x) => (
              <button
                key={x.key}
                type="button"
                aria-pressed={x.key === a.key}
                onClick={() => setPick(x.key)}
                className={`inline-flex h-9 items-center rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                  x.key === a.key ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}
        {a.pace && a.pace.points.length > 0 ? (
          <div className="rounded-xl border border-hairline p-3">
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
          <div className="rounded-xl border border-hairline p-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{volTitle}</p>
            <div className="mt-2">
              <WeekBars values={a.weeks.map((w) => w.value)} starts={a.weeks.map((w) => w.start)} color={CARDIO_COLOR} height={90} label={volTitle} tip={(v) => (a.measure === "min" ? `${num(v)} min` : `${num(v)} ${unitWord}`)} />
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
          <div className="rounded-xl border border-hairline p-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{volTitle}</p>
            <div className="mt-2">
              <WeekBars values={a.weeks.map((w) => w.value)} starts={a.weeks.map((w) => w.start)} color={CARDIO_COLOR} height={90} label={volTitle} tip={(v) => (a.measure === "min" ? `${num(v)} min` : `${num(v)} ${unitWord}`)} />
            </div>
          </div>
        )}
        <div>
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
        <div className="rounded-xl border border-hairline p-3">
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
          <div>
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
          <div className="flex justify-center">
            <Dots r={open} w={300} h={90} tips />
          </div>
          <ul className="divide-y divide-hairline text-sm">
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

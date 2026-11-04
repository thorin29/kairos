"use client";

import { useEffect, useState } from "react";
import { InfoIcon } from "@/components/icons";
import { NAV_LABEL, type NavRegion } from "@/lib/workouts/involvement";
import {
  DEFAULT_HEAT_RANGE,
  HEAT_RANGES,
  type HeatGroup,
  type HeatMap,
  type HeatRange,
  type HeatRangeKey,
} from "@/lib/workouts/heat";
import { readPref, writePref } from "./conditioning-timer";
import { Modal } from "./plan-file-panel";

/**
 * The body map's heat view (v0.635): one hue, three strengths, by counted sets
 * a week over the chosen range. The toggle and range are kept per device.
 */

const HEAT_ON_KEY = "kairos.heat.on";
const HEAT_RANGE_KEY = "kairos.heat.range";

const SHADE: Record<1 | 2 | 3, string> = {
  1: "color-mix(in srgb, var(--color-accent) 40%, var(--color-figure-fade))",
  2: "color-mix(in srgb, var(--color-accent) 70%, var(--color-figure-fade))",
  3: "var(--color-accent)",
};

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

export function heatFills(range: HeatRange | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of range?.groups ?? []) if (g.level > 0) out[g.group] = SHADE[g.level as 1 | 2 | 3];
  return out;
}

export function heatAvailable(range: HeatRange | undefined): NavRegion[] {
  const navs: NavRegion[] = [];
  for (const g of range?.groups ?? []) {
    if (g.level === 0) continue;
    navs.push(g.group === "DEADLIFT" ? "POSTERIOR_HIP" : (g.group as NavRegion));
  }
  return navs;
}

export function HeatRangeChips({ value, onChange }: { value: HeatRangeKey; onChange: (k: HeatRangeKey) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Range">
      {HEAT_RANGES.map((r) => {
        const on = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={r.label}
            onClick={() => onChange(r.key)}
            className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
              on ? "border-accent bg-accent text-white" : "border-accent text-accent hover:bg-accent/10"
            }`}
          >
            {r.short}
          </button>
        );
      })}
    </div>
  );
}

export function HeatKey() {
  const [about, setAbout] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
      {(
        [
          [1, "Under 4"],
          [2, "4–9"],
          [3, "10+"],
        ] as const
      ).map(([lvl, label]) => (
        <span key={lvl} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: SHADE[lvl] }} />
          {label}
        </span>
      ))}
      <span>sets a week</span>
      <button
        type="button"
        onClick={() => setAbout(true)}
        aria-label="About the heat map"
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-accent"
      >
        <InfoIcon className="h-4 w-4" />
      </button>
      {about && (
        <Modal title="Heat map" onClose={() => setAbout(false)}>
          <div className="space-y-2 text-sm">
            <p>Hard sets per muscle, averaged per week over the range you pick.</p>
            <p>
              A set counts in full when it ended within about 5 reps of what you could do, and half when 6–9 short.
              Warm-ups and easy sets don&apos;t count. Marking a lift Hard counts it in full; Easy counts it half.
            </p>
            <p>Muscles a lift only helps with get half a set.</p>
            <p>
              Holds count in full at two-thirds of your longest or more, half at 40%. A plank counts in full at 1:10,
              the Marine Corps PFT minimum, and shows its PFT points (3:45 is 100).
            </p>
            <p>Heavy sets are 6 reps or fewer near your best weight. They&apos;re what builds strength most.</p>
            <p>Around 10 or more hard sets a week is a strong week for a muscle.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function HeatDetail({
  nav,
  data,
  unit,
  onClose,
}: {
  nav: NavRegion;
  data: HeatGroup | undefined;
  unit: string;
  onClose: () => void;
}) {
  return (
    <Modal title={NAV_LABEL[nav]} onClose={onClose}>
      {!data || data.perWeek === 0 ? (
        <p className="text-sm text-muted">No hard sets in this range.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-hairline px-3 py-2">
              <p className="tabular text-xl font-semibold">{fmt(data.perWeek)}</p>
              <p className="text-xs text-muted">sets a week</p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-2">
              <p className="tabular text-xl font-semibold">{fmt(data.heavyPerWeek)}</p>
              <p className="text-xs text-muted">heavy sets a week</p>
            </div>
          </div>
          <HeatBests bests={data.bests} unit={unit} />
        </div>
      )}
    </Modal>
  );
}

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

export function rangeOf(heat: HeatMap | undefined, key: HeatRangeKey): HeatRange | undefined {
  return heat?.ranges.find((r) => r.key === key);
}

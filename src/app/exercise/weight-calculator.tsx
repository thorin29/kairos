"use client";

import { useMemo, useState } from "react";
import {
  ALL_PLATES,
  BARS,
  BUMPERS,
  FRACTIONS,
  PLATE_BY_ID,
  STEEL,
  fmtWeight,
  type BarOption,
  type BarType,
  type Plate,
} from "@/lib/workouts/plates";

const SCALE = 0.42; // px per mm
const SHAFT_HALF = 64; // px from centre to the collar on each side
const COLLAR = 14;
const END = 14; // gap from the last plate out to the bar end
const SLEEVE_MIN = 74; // shortest visible sleeve (an unloaded bar still looks loaded-ready)
const AXIS = 150; // vertical centre of the bar in the drawing

/** The bent grip of an EZ-curl bar, drawn as a thick stroked wave between the
 *  collars. A smooth many-point polyline reads cleanly at this stroke width. */
function ezShaftPath(cx: number): string {
  const L = cx - SHAFT_HALF;
  const R = cx + SHAFT_HALF;
  const s = L + 8;
  const e = R - 8;
  const A = 11;
  const N = 40;
  const parts = [`M ${L} ${AXIS}`, `L ${s} ${AXIS}`];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = s + (e - s) * t;
    const y = AXIS - A * Math.sin(2 * 2 * Math.PI * t);
    parts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  parts.push(`L ${R} ${AXIS}`);
  return parts.join(" ");
}

/** Draws the loaded barbell. `perSide` is the plates on ONE side, already sorted
 *  inner (largest) → outer; both sides are mirrored so the bar is symmetric.
 *  Real proportions: a narrow shaft between the collars, the collars as the
 *  widest step, then the sleeves stepping down and running out to the ends. */
function Barbell({ perSide, barType }: { perSide: Plate[]; barType: BarType }) {
  const sideThickness = perSide.reduce((s, p) => s + p.thicknessMm * SCALE, 0);
  const sleeveLen = Math.max(SLEEVE_MIN, sideThickness + END);
  const half = SHAFT_HALF + COLLAR + sleeveLen;
  const width = half * 2;
  const cx = width / 2;
  const height = 300;

  // Lay plates from the collar outward on the right; mirror for the left.
  const right: { p: Plate; x: number; w: number }[] = [];
  let x = cx + SHAFT_HALF + COLLAR;
  for (const p of perSide) {
    const w = p.thicknessMm * SCALE;
    right.push({ p, x, w });
    x += w + 1.5;
  }

  const plateRect = (p: Plate, px: number, w: number, mirror: boolean) => {
    const h = p.diameterMm * SCALE;
    const drawX = mirror ? width - px - w : px;
    const label = fmtWeight(p.weight);
    return (
      <g key={`${mirror ? "l" : "r"}-${px}`}>
        <rect
          x={drawX}
          y={AXIS - h / 2}
          width={w}
          height={h}
          rx={Math.min(6, w / 2)}
          fill={p.color}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={1}
        />
        {w > 16 && (
          <text
            x={drawX + w / 2}
            y={AXIS}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(90 ${drawX + w / 2} ${AXIS})`}
            fontSize={13}
            fontWeight={600}
            fill={p.darkLabel ? "#1f1f22" : "#ffffff"}
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Loaded barbell"
    >
      {/* sleeves — step down from the collars and run out to the bar ends */}
      <rect
        x={cx + SHAFT_HALF + COLLAR}
        y={AXIS - 11}
        width={sleeveLen}
        height={22}
        rx={5}
        fill="#b7bdc4"
      />
      <rect
        x={cx - SHAFT_HALF - COLLAR - sleeveLen}
        y={AXIS - 11}
        width={sleeveLen}
        height={22}
        rx={5}
        fill="#b7bdc4"
      />
      {/* end caps at the very ends of the sleeves */}
      <rect x={width - 5} y={AXIS - 13} width={5} height={26} rx={2} fill="#8c939b" />
      <rect x={0} y={AXIS - 13} width={5} height={26} rx={2} fill="#8c939b" />

      {/* collars — the widest step */}
      <rect x={cx + SHAFT_HALF} y={AXIS - 16} width={COLLAR} height={32} rx={3} fill="#7c848d" />
      <rect x={cx - SHAFT_HALF - COLLAR} y={AXIS - 16} width={COLLAR} height={32} rx={3} fill="#7c848d" />

      {/* shaft — narrowest, only between the collars */}
      {barType === "ez" ? (
        <path
          d={ezShaftPath(cx)}
          fill="none"
          stroke="#9aa1a9"
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <rect
          x={cx - SHAFT_HALF}
          y={AXIS - 6}
          width={2 * SHAFT_HALF}
          height={12}
          rx={6}
          fill="#9aa1a9"
        />
      )}

      {right.map(({ p, x, w }) => plateRect(p, x, w, false))}
      {right.map(({ p, x, w }) => plateRect(p, x, w, true))}
    </svg>
  );
}

function PlateButton({
  plate,
  onAdd,
}: {
  plate: Plate;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex h-12 min-w-[3.25rem] flex-col items-center justify-center rounded-xl border-2 px-2 text-sm font-semibold shadow-sm transition-transform active:scale-95"
      style={{
        backgroundColor: plate.color,
        color: plate.darkLabel ? "#1f1f22" : "#ffffff",
        borderColor: "rgba(0,0,0,0.2)",
      }}
      aria-label={`Add ${fmtWeight(plate.weight)} pound plates`}
    >
      {fmtWeight(plate.weight)}
    </button>
  );
}

export function WeightCalculator({ onClose }: { onClose: () => void }) {
  const [bar, setBar] = useState<BarOption>(BARS[0]);
  const [loaded, setLoaded] = useState<string[]>([]); // plate ids, one entry = one pair

  const add = (id: string) => setLoaded((l) => [...l, id]);
  const removeOne = (id: string) =>
    setLoaded((l) => {
      const i = l.lastIndexOf(id);
      if (i === -1) return l;
      const next = l.slice();
      next.splice(i, 1);
      return next;
    });
  const clear = () => setLoaded([]);

  const total = useMemo(
    () => bar.weight + loaded.reduce((s, id) => s + (PLATE_BY_ID[id]?.weight ?? 0) * 2, 0),
    [bar, loaded],
  );

  // One side, sorted inner (largest diameter, then heaviest) → outer.
  const perSide = useMemo(() => {
    const plates = loaded.map((id) => PLATE_BY_ID[id]).filter(Boolean) as Plate[];
    return plates.sort(
      (a, b) => b.diameterMm - a.diameterMm || b.weight - a.weight,
    );
  }, [loaded]);

  // Count how many pairs of each id are loaded, for the removable chips.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of loaded) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [loaded]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-hairline bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Weight calculator</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Barbell */}
        <div className="rounded-2xl border border-hairline bg-ground/30 px-2 py-3">
          <Barbell perSide={perSide} barType={bar.type} />
        </div>

        {/* Total */}
        <div className="mt-3 text-center">
          <span className="tabular font-display text-5xl font-bold leading-none">
            {fmtWeight(total)}
          </span>
          <span className="ml-2 text-lg text-muted">lb</span>
        </div>

        {/* Bar + clear */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Bar</span>
            {BARS.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => setBar(b)}
                className={[
                  "rounded-full border px-3 py-1 text-sm font-medium",
                  bar.label === b.label
                    ? "border-accent text-accent"
                    : "border-hairline text-muted",
                ].join(" ")}
              >
                {b.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={loaded.length === 0}
            className="rounded-full border border-hairline px-3 py-1 text-sm font-medium text-muted transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-40"
          >
            Clear
          </button>
        </div>

        {/* Loaded (tap to remove a pair) */}
        {loaded.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...counts.entries()].map(([id, n]) => {
              const p = PLATE_BY_ID[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => removeOne(id)}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: p.color,
                    color: p.darkLabel ? "#1f1f22" : "#ffffff",
                    borderColor: "rgba(0,0,0,0.2)",
                  }}
                  aria-label={`Remove a pair of ${fmtWeight(p.weight)} pound plates`}
                >
                  {fmtWeight(p.weight)} ×{n} ✕
                </button>
              );
            })}
          </div>
        )}

        {/* Plate pickers */}
        <div className="mt-5 space-y-4">
          <PlateRow title="Bumpers" plates={BUMPERS} onAdd={add} />
          <PlateRow title="Steel" plates={STEEL} onAdd={add} />
          <PlateRow title="Fractional" plates={FRACTIONS} onAdd={add} />
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Each tap adds a pair — one plate per side.
        </p>
      </div>
    </div>
  );
}

function PlateRow({
  title,
  plates,
  onAdd,
}: {
  title: string;
  plates: Plate[];
  onAdd: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {plates.map((p) => (
          <PlateButton key={p.id} plate={p} onAdd={() => onAdd(p.id)} />
        ))}
      </div>
    </div>
  );
}

// Re-export so callers can gauge whether any plates exist to show.
export const PLATE_COUNT = ALL_PLATES.length;

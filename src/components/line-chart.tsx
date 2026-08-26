"use client";

import { useMemo, useState } from "react";

export type Series = {
  id: string;
  name: string;
  color: string;
  unit: string;
  points: { date: string; value: number }[];
};

const W = 520;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

/**
 * Build a weight axis from real plate math: gridlines land on round, gym-legible
 * loads (45, 90, 135…) stepping by a plate-friendly amount, starting at the
 * lowest logged weight (snapped down to a line) and clearing the highest. An odd
 * max just floats between lines — its exact value is on the dot — so the scale
 * never reads 191 or 212.
 */
function weightTicks(lo: number, hi: number, unit: string) {
  const ladder =
    unit === "kg" ? [2.5, 5, 10, 20, 25, 50, 100] : [5, 10, 25, 45, 90, 135, 225];
  if (!(hi > lo)) hi = lo + ladder[0];
  let step = ladder[ladder.length - 1];
  for (const s of ladder) {
    const start = Math.floor(lo / s) * s;
    if ((hi - start) / s <= 6) {
      step = s;
      break;
    }
  }
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(Number(v.toFixed(2)));
  return { ticks, yMin, yMax };
}

export function LineChart({
  series,
  weight = false,
}: {
  series: Series[];
  weight?: boolean;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = series.filter((s) => !hidden.has(s.id));

  const { xMin, xMax, yMin, yMax, ticks } = useMemo(() => {
    const pts = visible.flatMap((s) => s.points);
    if (pts.length === 0) {
      return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, ticks: [0, 1] };
    }
    const xs = pts.map((p) => Date.parse(`${p.date}T00:00:00Z`));
    const ys = pts.map((p) => p.value);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);

    if (weight) {
      const unit = visible.find((s) => s.points.length > 0)?.unit ?? "lb";
      const w = weightTicks(lo, hi, unit);
      return {
        xMin: Math.min(...xs),
        xMax: Math.max(...xs),
        yMin: w.yMin,
        yMax: w.yMax,
        ticks: w.ticks,
      };
    }

    // Generic metrics: evenly spaced ticks with a little headroom.
    let gLo = lo;
    let gHi = hi;
    if (gLo === gHi) {
      gLo -= 5;
      gHi += 5;
    }
    const pad = (gHi - gLo) * 0.1;
    const y0 = Math.max(0, gLo - pad);
    const y1 = gHi + pad;
    const n = 4;
    const gticks = Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);
    return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: y0, yMax: y1, ticks: gticks };
  }, [visible, weight]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (ms: number) =>
    PAD.left + (xMax === xMin ? plotW / 2 : ((ms - xMin) / (xMax - xMin)) * plotW);
  const y = (v: number) =>
    PAD.top + plotH - (yMax === yMin ? plotH / 2 : ((v - yMin) / (yMax - yMin)) * plotH);

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const fmtTick = (t: number) =>
    Number.isInteger(t) ? String(t) : t.toFixed(1);

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const anyPoints = series.some((s) => s.points.length > 0);
  if (!anyPoints) {
    return (
      <p className="rounded-xl border border-hairline bg-ground/30 p-6 text-center text-sm text-muted">
        No numbers logged yet — record a session below and it&rsquo;ll chart here.
      </p>
    );
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Progress over time"
      >
        {/* y grid + labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-hairline)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-[var(--color-muted)] text-[9px]"
            >
              {fmtTick(t)}
            </text>
          </g>
        ))}

        {/* x end labels */}
        <text x={PAD.left} y={H - 8} className="fill-[var(--color-muted)] text-[9px]">
          {fmtDate(xMin)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 8}
          textAnchor="end"
          className="fill-[var(--color-muted)] text-[9px]"
        >
          {fmtDate(xMax)}
        </text>

        {/* lines */}
        {visible.map((s) => {
          const d = s.points
            .map((p, i) => {
              const px = x(Date.parse(`${p.date}T00:00:00Z`));
              const py = y(p.value);
              return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
            })
            .join(" ");
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {s.points.map((p, i) => (
                <circle
                  key={i}
                  cx={x(Date.parse(`${p.date}T00:00:00Z`))}
                  cy={y(p.value)}
                  r={3}
                  fill={s.color}
                >
                  <title>
                    {s.name}: {p.value}
                    {s.unit} · {fmtDate(Date.parse(`${p.date}T00:00:00Z`))}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {series.map((s) => {
          const off = hidden.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                off ? "border-hairline text-muted opacity-50" : "border-hairline",
              ].join(" ")}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

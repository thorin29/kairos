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
const PAD = { top: 16, right: 16, bottom: 30, left: 60 };

// Common barbell loads (bar + standard plate pairs). Labeled on the axis; the
// lighter minor lines fill in between.
const COMMON_LB = [45, 65, 95, 115, 135, 155, 185, 205, 225, 245, 275, 315, 365, 405, 455, 495, 545, 585];
const COMMON_KG = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200, 220, 240, 260];

/**
 * A weight axis in real gym numbers: light gridlines every plate-step, with the
 * common loads (45, 95, 135, 185…) labeled. Starts at the lowest logged lift and
 * clears the highest; an odd max just floats between lines.
 */
function weightGrid(lo: number, hi: number, unit: string) {
  const kg = unit === "kg";
  const minorStep = kg ? 5 : 10;
  const common = kg ? COMMON_KG : COMMON_LB;

  const yMin = Math.floor(lo / minorStep) * minorStep;
  let yMax = Math.ceil(hi / minorStep) * minorStep;
  if (yMax <= yMin) yMax = yMin + minorStep * 2;

  const minor: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += minorStep) minor.push(v);

  let major = common.filter((v) => v >= yMin && v <= yMax);
  if (major.length < 2) {
    // Range sits between common loads — label a sparse set of the minor lines.
    const stride = Math.max(1, Math.ceil(minor.length / 5));
    major = minor.filter((_, i) => i % stride === 0);
  }
  return { yMin, yMax, minor, major };
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

  const { xMin, xMax, yMin, yMax, major, minor } = useMemo(() => {
    const pts = visible.flatMap((s) => s.points);
    if (pts.length === 0) {
      return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, major: [0, 1], minor: [] as number[] };
    }
    const xs = pts.map((p) => Date.parse(`${p.date}T00:00:00Z`));
    const ys = pts.map((p) => p.value);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);

    if (weight) {
      const unit = visible.find((s) => s.points.length > 0)?.unit ?? "lb";
      const g = weightGrid(lo, hi, unit);
      return {
        xMin: Math.min(...xs),
        xMax: Math.max(...xs),
        yMin: g.yMin,
        yMax: g.yMax,
        major: g.major,
        minor: g.minor,
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
    const ticks = Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);
    return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: y0, yMax: y1, major: ticks, minor: [] as number[] };
  }, [visible, weight]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (ms: number) =>
    PAD.left + (xMax === xMin ? plotW / 2 : ((ms - xMin) / (xMax - xMin)) * plotW);
  const y = (v: number) =>
    PAD.top + plotH - (yMax === yMin ? plotH / 2 : ((v - yMin) / (yMax - yMin)) * plotH);

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const fmtTick = (t: number) => (Number.isInteger(t) ? String(t) : t.toFixed(1));

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
        {/* minor gridlines (weights only): light, dotted, no label */}
        {minor.map((t, i) => (
          <line
            key={`m${i}`}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--color-hairline)"
            strokeWidth={1}
            strokeDasharray="2 4"
            opacity={0.5}
          />
        ))}

        {/* major gridlines + labels */}
        {major.map((t, i) => (
          <g key={`M${i}`}>
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
              fill="var(--color-muted)"
              fontSize={14}
            >
              {fmtTick(t)}
            </text>
          </g>
        ))}

        {/* x end labels */}
        <text x={PAD.left} y={H - 8} fill="var(--color-muted)" fontSize={13}>
          {fmtDate(xMin)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 8}
          textAnchor="end"
              fill="var(--color-muted)"
              fontSize={14}
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

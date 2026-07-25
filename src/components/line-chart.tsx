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
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

export function LineChart({ series }: { series: Series[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = series.filter((s) => !hidden.has(s.id));

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    const pts = visible.flatMap((s) => s.points);
    if (pts.length === 0) {
      return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    }
    const xs = pts.map((p) => Date.parse(`${p.date}T00:00:00Z`));
    const ys = pts.map((p) => p.value);
    let lo = Math.min(...ys);
    let hi = Math.max(...ys);
    if (lo === hi) {
      lo = lo - 5;
      hi = hi + 5;
    }
    // A little headroom.
    const pad = (hi - lo) * 0.1;
    return {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.max(0, lo - pad),
      yMax: hi + pad,
    };
  }, [visible]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (ms: number) =>
    PAD.left + (xMax === xMin ? plotW / 2 : ((ms - xMin) / (xMax - xMin)) * plotW);
  const y = (v: number) =>
    PAD.top + plotH - (yMax === yMin ? plotH / 2 : ((v - yMin) / (yMax - yMin)) * plotH);

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

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
              {Math.round(t)}
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
                />
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {series.map((s) => {
          const off = hidden.has(s.id);
          const last = s.points[s.points.length - 1];
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
              {last && !off && (
                <span className="tabular text-muted">
                  {last.value}
                  {s.unit}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

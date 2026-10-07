"use client";

import { useState } from "react";
import { weightGrid } from "@/components/line-chart";
import type { MovementComparison } from "@/lib/queries/workouts";

/**
 * One movement, one bar per weight, grouped by person.
 *
 * Not a bar per person: a lifter who has worked up through 155, 175 and 185
 * has three things worth seeing, and flattening them to a single "best" throws
 * away the shape of the progression. Not a bar per SET either — 175x2 and
 * 175x3 are the same bar drawn twice, so a weight appears once carrying the
 * best reps achieved at it.
 *
 * Bars are a fixed width and never stretch to fill. A chart whose bars change
 * thickness as people are added is a chart where width means nothing, and the
 * eye reads thickness whether or not it was meant to.
 */

/** Total bars drawn. Beyond this the axis labels collide and nothing reads. */
const MAX_BARS = 18;
const BAR_W = 26;
const BAR_GAP = 6;
const GROUP_GAP = 44;
const PAD_L = 48;
const PAD_R = 8;
const PAD_T = 26;
const PLOT_H = 200;
const LABEL_H = 26;

export function CompareView({ movements }: { movements: MovementComparison[] }) {
  const weightMovements = movements.filter((m) => m.metric === "WEIGHT");
  const [id, setId] = useState(weightMovements[0]?.poolExerciseId ?? "");
  const current =
    weightMovements.find((m) => m.poolExerciseId === id) ?? weightMovements[0];
  if (!current) return null;

  const withBars = current.series.filter((s) => (s.bars?.length ?? 0) > 0);

  // Share the budget evenly, so one prolific lifter cannot crowd everyone else
  // out. `bars` arrives newest-first, so slicing keeps what is current.
  const perPerson = Math.max(1, Math.floor(MAX_BARS / Math.max(withBars.length, 1)));
  const groups = withBars.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    // Shown lightest to heaviest: a person's bars should climb, not jump about
    // in whatever order they were logged.
    bars: [...(s.bars ?? [])].slice(0, perPerson).sort((a, b) => a.value - b.value),
  }));

  const all = groups.flatMap((g) => g.bars);
  if (all.length === 0) {
    return (
      <Shell current={current} movements={weightMovements} onPick={setId}>
        <p className="text-sm text-muted">Nothing logged for this movement yet.</p>
      </Shell>
    );
  }

  // The same axis the dot charts use — plate-step gridlines labelled at the
  // common loads (45, 95, 135, 185). Passing 0 as the low keeps the bars on a
  // zero baseline, because a bar chart that floats lies about proportion,
  // while the labels stay numbers a person actually loads.
  const top = Math.max(...all.map((b) => b.value));
  const grid = weightGrid(0, top, current.unit);
  const ceil = Math.max(grid.yMax, 1);
  // The top line, when yMax lands on a round load (ending 0 or 5), is drawn
  // solid and labelled like the others — otherwise the tallest bar ends against
  // a dotted line with no number to read it against.
  const topIsRound = grid.yMax % 5 === 0;
  const ticks =
    topIsRound && !grid.major.includes(grid.yMax)
      ? [...grid.major, grid.yMax]
      : grid.major;
  // The dotted lines between the labelled loads. Without them a bar that tops
  // out above the last common load floats over blank space with nothing to
  // read it against.
  const minorTicks = grid.minor.filter((v) => !grid.major.includes(v));

  const width =
    PAD_L +
    PAD_R +
    groups.reduce(
      (acc, g) => acc + g.bars.length * BAR_W + (g.bars.length - 1) * BAR_GAP,
      0,
    ) +
    GROUP_GAP * Math.max(groups.length - 1, 0);
  const height = PAD_T + PLOT_H + LABEL_H;

  let x = PAD_L;
  const placed = groups.map((g) => {
    const start = x;
    const bars = g.bars.map((b) => {
      const bx = x;
      x += BAR_W + BAR_GAP;
      return { ...b, x: bx };
    });
    x += GROUP_GAP - BAR_GAP;
    const span = bars.length * BAR_W + (bars.length - 1) * BAR_GAP;
    return { ...g, bars, center: start + span / 2 };
  });

  return (
    <Shell current={current} movements={weightMovements} onPick={setId}>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          /* Centred and allowed to grow into spare room, but only so far: an
             unbounded stretch on a wide screen blows the labels up with it. */
          style={{
            width: "100%",
            maxWidth: Math.round(width * 1.7),
            minWidth: Math.min(width, 320),
            height: "auto",
            display: "block",
            margin: "0 auto",
          }}
          role="img"
          aria-label={`Best sets for ${current.name}`}
        >
          {minorTicks.map((t) => {
            const y = PAD_T + PLOT_H - (t / ceil) * PLOT_H;
            return (
              <line
                key={`m${t}`}
                x1={PAD_L - 4}
                x2={width - PAD_R}
                y1={y}
                y2={y}
                stroke="var(--color-muted)"
                strokeWidth={1}
                strokeDasharray="2 4"
                opacity={0.22}
              />
            );
          })}
          {ticks.map((t) => {
            const y = PAD_T + PLOT_H - (t / ceil) * PLOT_H;
            return (
              <g key={t}>
                <line
                  x1={PAD_L - 4}
                  x2={width - PAD_R}
                  y1={y}
                  y2={y}
                  stroke="var(--color-hairline)"
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--color-muted)"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {placed.map((g) => (
            <g key={g.id}>
              {g.bars.map((b) => {
                const h = Math.max((b.value / ceil) * PLOT_H, 2);
                const y = PAD_T + PLOT_H - h;
                return (
                  <g key={`${b.value}-${b.date}`}>
                    <rect
                      x={b.x}
                      y={y}
                      width={BAR_W}
                      height={h}
                      rx={3}
                      fill={g.color}
                    >
                      {/* Hover gives the weight, which the axis only approximates. */}
                      <title>{`${g.name} — ${b.value} ${current.unit} × ${b.reps} on ${b.date}`}</title>
                    </rect>
                    {/* A bar exists because a set was done, so x1 is implied.
                        Only a count worth noticing is written. Muted, but still
                        darker than any gridline, and tucked against the bar. */}
                    {b.reps > 1 && (
                      <text
                        x={b.x + BAR_W / 2}
                        y={y - 3}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill="var(--color-muted)"
                      >
                        <tspan fontSize={7} fontWeight={500}>
                          ×
                        </tspan>
                        {b.reps}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={g.center}
                y={PAD_T + PLOT_H + 16}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-muted)"
              >
                {g.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </Shell>
  );
}

function Shell({
  current,
  movements,
  onPick,
  children,
}: {
  current: MovementComparison;
  movements: MovementComparison[];
  onPick: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Compare</h2>
        <select
          value={current.poolExerciseId}
          onChange={(e) => onPick(e.target.value)}
          className="h-9 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
        >
          {movements.map((m) => (
            <option key={m.poolExerciseId} value={m.poolExerciseId}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {children}
    </div>
  );
}

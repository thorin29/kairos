"use client";

import { useEffect, useRef } from "react";
import type { GridEvent } from "@/lib/queries/calendar";
import { DAY_SHORT } from "@/lib/days";

const HOUR_PX = 56;
const COLUMNS = "grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";

/**
 * Outlook-style week: hour gutter down the left, a column per day, blocks
 * positioned by minutes from midnight.
 *
 * The day header and the all-day band sit *inside* the scroll container and
 * stick to the top, with a heavier rule beneath them so the frozen rows read
 * as a separate plane from the grid that scrolls under them. Keeping them outside it made them a different width to
 * the body whenever a scrollbar appeared, so the dates drifted out of line
 * with their columns.
 *
 * The grid renders all 24 hours but scrolls to the earliest event on mount,
 * so a 7am practice is visible without hiding a midnight shift.
 */
export function WeekGrid({
  days,
  timed,
  allDay,
  todayISO,
  onSelectDay,
  selectedDay,
}: {
  days: string[];
  timed: GridEvent[];
  allDay: GridEvent[];
  todayISO: string;
  onSelectDay: (iso: string) => void;
  selectedDay: string | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scroller.current) return;
    const earliest = timed.length
      ? Math.min(...timed.map((e) => e.startMin))
      : 8 * 60;
    scroller.current.scrollTop = Math.max(0, ((earliest - 60) / 60) * HOUR_PX);
  }, [timed]);

  const byDay = (iso: string) => timed.filter((e) => e.dayISO === iso);

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div
        ref={scroller}
        className="max-h-[36rem] overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        {/* Frozen header. Same container, same width, so columns line up. */}
        <div className="sticky top-0 z-20 shadow-[0_1px_0_0_var(--color-ink)]">
          <div className={`grid ${COLUMNS} border-b-2 border-ink/25 bg-shade`}>
            <div />
            {days.map((iso) => {
              const d = new Date(`${iso}T00:00:00Z`);
              const isToday = iso === todayISO;
              const isSelected = selectedDay === iso;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onSelectDay(iso)}
                  className={`border-l border-ink/15 px-1 py-2.5 text-center transition-colors ${
                    isSelected ? "bg-accent/15" : "hover:bg-shade-soft"
                  }`}
                >
                  <span className="block text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
                    {DAY_SHORT[d.getUTCDay()]}
                  </span>
                  <span
                    className={`tabular mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                      isToday ? "bg-accent text-white" : ""
                    }`}
                  >
                    {d.getUTCDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {allDay.length > 0 && (
            <div
              className={`grid ${COLUMNS} border-b border-ink/20 bg-shade-soft`}
            >
              <div className="px-2 py-2 text-right text-[0.6rem] uppercase tracking-wide text-muted">
                All day
              </div>
              {days.map((iso) => (
                <div key={iso} className="border-l border-ink/10 p-1">
                  {allDay
                    .filter((e) => e.dayISO === iso)
                    .map((e) => (
                      <span
                        key={e.id}
                        title={`${e.title}${e.location ? ` · ${e.location}` : ""}`}
                        className="mb-1 block truncate rounded px-1.5 py-1 text-[0.7rem] font-medium text-white"
                        style={{ backgroundColor: e.color }}
                      >
                        {e.title}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`relative grid ${COLUMNS}`}>
          <div>
            {Array.from({ length: 24 }, (_, h) => (
              <HourCell key={h} label={hourLabel(h)} />
            ))}
          </div>

          {days.map((iso) => {
            const events = byDay(iso);
            const lanes = assignLanes(events);

            return (
              <div
                key={iso}
                className={`relative border-l border-hairline ${
                  selectedDay === iso ? "bg-accent/5" : ""
                }`}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <HourCell key={h} />
                ))}

                {events.map((e) => {
                  const lane = lanes.get(e.id) ?? { index: 0, of: 1 };
                  const top = (e.startMin / 60) * HOUR_PX;
                  const height = Math.max(
                    ((e.endMin - e.startMin) / 60) * HOUR_PX - 2,
                    18,
                  );
                  const width = 100 / lane.of;

                  return (
                    <div
                      key={e.id}
                      title={`${e.title}\n${e.timeLabel}${
                        e.location ? `\n${e.location}` : ""
                      }\n${e.ownerName}`}
                      className="absolute overflow-hidden rounded-md px-1.5 py-1 text-[0.7rem] leading-tight text-white shadow-sm"
                      style={{
                        top,
                        height,
                        left: `calc(${lane.index * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        backgroundColor: e.color,
                      }}
                    >
                      <span className="block truncate font-medium">
                        {e.title}
                      </span>
                      {height > 34 && (
                        <span className="tabular block truncate opacity-90">
                          {e.timeLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * One hour, split by a dashed half-hour rule. Without it a 3:30 start looks
 * identical to a 3:15 one, and reading the grid means counting pixels.
 */
function HourCell({ label }: { label?: string }) {
  return (
    <div
      style={{ height: HOUR_PX }}
      className="relative border-b border-hairline"
    >
      <div
        style={{ height: HOUR_PX / 2 }}
        className="border-b border-dashed border-hairline"
        aria-hidden
      />
      {label && (
        <span className="tabular absolute -top-2 right-2 bg-surface px-1 text-[0.65rem] text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

function hourLabel(h: number): string | undefined {
  if (h === 0) return undefined;
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

/**
 * Side-by-side placement for overlapping blocks. Greedy: an event takes the
 * first lane whose last event has already finished. Good enough for a family
 * schedule, and it degrades gracefully when three things collide.
 */
function assignLanes(events: GridEvent[]) {
  const result = new Map<string, { index: number; of: number }>();
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin);

  let cluster: GridEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const placed = new Map<string, number>();

    for (const e of cluster) {
      let lane = laneEnds.findIndex((end) => end <= e.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(e.endMin);
      } else {
        laneEnds[lane] = e.endMin;
      }
      placed.set(e.id, lane);
    }

    for (const e of cluster) {
      result.set(e.id, { index: placed.get(e.id) ?? 0, of: laneEnds.length });
    }
    cluster = [];
  };

  for (const e of sorted) {
    if (cluster.length > 0 && e.startMin >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  flush();

  return result;
}

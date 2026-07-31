"use client";

import { useEffect, useRef, useState } from "react";
import type { GridEvent } from "@/lib/queries/calendar";
import { DAY_SHORT } from "@/lib/days";
import { useAddEvent } from "@/app/calendar/add-event-form";

const HOUR_PX = 56;

function minutesToHHMM(min: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 45, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Outlook-style time grid: an hour gutter down the left and a column per day
 * (one day or a whole week). Blocks are positioned by minutes from midnight.
 *
 * Scrolling behaviour:
 *  - On mount (and after inactivity) it anchors to a sensible spot: the day's
 *    earliest event in the morning, then follows the clock into the afternoon
 *    so evening events come into view.
 *  - A now-line tracks the current time (updates each minute) in whatever
 *    colour the admin chose.
 *  - Manual scrolling always works; after `resetSec` of no scrolling it eases
 *    back to the anchor. resetSec of 0 turns the reset off.
 */
export function WeekGrid({
  days,
  timed,
  allDay,
  todayISO,
  onSelectDay,
  selectedDay,
  nowColor = "#ef4444",
  resetSec = 60,
}: {
  days: string[];
  timed: GridEvent[];
  allDay: GridEvent[];
  todayISO: string;
  onSelectDay?: (iso: string) => void;
  selectedDay?: string | null;
  nowColor?: string;
  resetSec?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openAt } = useAddEvent();

  const [nowMin, setNowMin] = useState<number | null>(null);

  // Drag-to-select a time range (mouse/pen). Touch is left alone so the grid
  // still scrolls with a finger; a touch tap falls through to click-to-add.
  const [sel, setSel] = useState<{ day: string; a: number; b: number } | null>(
    null,
  );
  const dragging = useRef(false);
  const suppressClick = useRef(false);

  const yToMin = (el: HTMLElement, clientY: number) => {
    const rect = el.getBoundingClientRect();
    const raw = ((clientY - rect.top) / HOUR_PX) * 60;
    return clamp(Math.round(raw / 15) * 15, 0, 24 * 60);
  };

  const onColDown = (iso: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const min = yToMin(e.currentTarget, e.clientY);
    dragging.current = true;
    setSel({ day: iso, a: min, b: min });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onColMove = (iso: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const min = yToMin(e.currentTarget, e.clientY);
    setSel((s) => (s && s.day === iso ? { ...s, b: min } : s));
  };

  const onColUp = (iso: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    const s = sel;
    setSel(null);
    if (!s) return;
    const lo = Math.min(s.a, s.b);
    const hi = Math.max(s.a, s.b);
    if (hi - lo >= 15) {
      // A real drag: open pre-filled with the range, and swallow the click
      // the browser fires right after.
      suppressClick.current = true;
      openAt({ date: iso, start: minutesToHHMM(lo), end: minutesToHHMM(hi) });
    }
  };

  const gridTemplateColumns = `3.5rem repeat(${days.length}, minmax(0,1fr))`;
  const todayInView = days.includes(todayISO);

  // Current time, refreshed each minute (client-only to avoid SSR mismatch).
  useEffect(() => {
    const upd = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    upd();
    const id = setInterval(upd, 60_000);
    return () => clearInterval(id);
  }, []);

  const anchorTop = (): number => {
    const el = scroller.current;
    const visibleMin = el ? (el.clientHeight / HOUR_PX) * 60 : 600;
    const earliest = timed.length
      ? Math.min(...timed.map((e) => e.startMin))
      : 8 * 60;
    // Morning: earliest event near the top. Afternoon (today only): follow the
    // clock so later/evening events scroll into view.
    const base =
      todayInView && nowMin != null
        ? clamp(nowMin - 120, earliest - 60, 24 * 60 - visibleMin)
        : earliest - 60;
    return Math.max(0, (base / 60) * HOUR_PX);
  };

  const scrollToAnchor = (smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTo({ top: anchorTop(), behavior: smooth ? "smooth" : "auto" });
    // Ignore scroll events from our own (possibly animated) scroll.
    window.setTimeout(() => (programmatic.current = false), smooth ? 800 : 60);
  };

  // Anchor on mount and whenever the day's events change.
  useEffect(() => {
    scrollToAnchor(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed]);

  const onScroll = () => {
    if (programmatic.current || resetSec <= 0) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => scrollToAnchor(true), resetSec * 1000);
  };

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const byDay = (iso: string) => timed.filter((e) => e.dayISO === iso);

  const createAt = (iso: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const min = Math.round((((e.clientY - rect.top) / HOUR_PX) * 60) / 15) * 15;
    openAt({ date: iso, start: minutesToHHMM(min) });
  };

  const nowY = nowMin != null ? (nowMin / 60) * HOUR_PX : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="max-h-[36rem] overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        {/* Frozen header. Same container, same width, so columns line up. */}
        <div className="sticky top-0 z-20 shadow-[0_1px_0_0_var(--color-ink)]">
          <div
            className="grid border-b-2 border-ink/25 bg-shade"
            style={{ gridTemplateColumns }}
          >
            <div />
            {days.map((iso) => {
              const d = new Date(`${iso}T00:00:00Z`);
              const isToday = iso === todayISO;
              const isSelected = selectedDay === iso;
              const inner = (
                <>
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
                </>
              );
              return onSelectDay ? (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onSelectDay(iso)}
                  className={`border-l border-ink/15 px-1 py-2.5 text-center transition-colors ${
                    isSelected ? "bg-accent/15" : "hover:bg-shade-soft"
                  }`}
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={iso}
                  className="border-l border-ink/15 px-1 py-2.5 text-center"
                >
                  {inner}
                </div>
              );
            })}
          </div>

          {allDay.length > 0 && (
            <div
              className="grid border-b border-ink/20 bg-shade-soft"
              style={{ gridTemplateColumns }}
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

        <div className="relative grid" style={{ gridTemplateColumns }}>
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
                onClick={(e) => createAt(iso, e)}
                onPointerDown={(e) => onColDown(iso, e)}
                onPointerMove={(e) => onColMove(iso, e)}
                onPointerUp={(e) => onColUp(iso, e)}
                title="Tap to add an event, or drag to pick a time range"
                className={`relative cursor-pointer select-none border-l border-hairline ${
                  selectedDay === iso ? "bg-accent/5" : ""
                }`}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <HourCell key={h} />
                ))}

                {sel?.day === iso &&
                  (() => {
                    const lo = Math.min(sel.a, sel.b);
                    const hi = Math.max(sel.a, sel.b);
                    return (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0.5 z-[5] rounded-md border border-accent/60 bg-accent/25"
                        style={{
                          top: (lo / 60) * HOUR_PX,
                          height: Math.max(((hi - lo) / 60) * HOUR_PX, 2),
                        }}
                      />
                    );
                  })()}

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
                      onClick={(ev) => ev.stopPropagation()}
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

          {/* Now-line, spanning the day columns (not the hour gutter). */}
          {todayInView && nowY != null && (
            <div
              aria-hidden
              className="pointer-events-none absolute z-10 flex items-center"
              style={{ top: nowY - 1, left: "3.5rem", right: 0 }}
            >
              <span
                className="-ml-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: nowColor }}
              />
              <span
                className="h-0.5 flex-1"
                style={{ backgroundColor: nowColor }}
              />
            </div>
          )}
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

"use client";

import { useEffect, useRef, useState } from "react";
import type { GridEvent } from "@/lib/queries/calendar";
import { DAY_SHORT } from "@/lib/days";
import { useAddEvent } from "@/app/calendar/add-event-form";
import { EventMenu, type MenuItem } from "@/components/event-menu";
import { eventCopyData, deleteEvent } from "@/lib/actions/events";

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
  const { openAt, openEdit } = useAddEvent();

  const [nowMin, setNowMin] = useState<number | null>(null);

  // Tap highlights an event; long-press (touch) or right-click (desktop) opens
  // its action menu.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ ev: GridEvent; x: number; y: number } | null>(
    null,
  );

  // Two-finger scroll: native one-finger panning is switched off (touch-action
  // none) and a two-finger drag moves the grid by hand, so a single finger is
  // free to land on an event. Loses momentum flick, fine on a grid this short.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pan = useRef<{ startMid: number; startScroll: number } | null>(null);

  // Long-press bookkeeping (touch only).
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pressMoved = useRef(false);

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const openMenu = (ev: GridEvent, x: number, y: number) => {
    setSelectedId(ev.id);
    setMenu({ ev, x, y });
  };

  const midY = () => {
    const ps = [...pointers.current.values()];
    if (ps.length === 0) return 0;
    return ps.reduce((s, p) => s + p.y, 0) / ps.length;
  };

  const onScrollerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // A second finger means "scroll", not "act on an event".
      cancelPress();
      setSel(null);
      dragging.current = false;
      pan.current = {
        startMid: midY(),
        startScroll: scroller.current?.scrollTop ?? 0,
      };
    }
  };

  const onScrollerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pan.current && pointers.current.size >= 2 && scroller.current) {
      scroller.current.scrollTop =
        pan.current.startScroll - (midY() - pan.current.startMid);
      e.preventDefault();
    }
  };

  const onScrollerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pan.current = null;
  };

  // A tap on an event highlights it; a long hold opens its menu.
  const onEventDown = (ev: GridEvent, e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pressMoved.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    const gx = e.clientX;
    const gy = e.clientY;
    cancelPress();
    pressTimer.current = setTimeout(() => {
      if (!pressMoved.current && pointers.current.size < 2) openMenu(ev, gx, gy);
    }, 500);
  };

  const onEventMove = (e: React.PointerEvent) => {
    if (!pressTimer.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > 10) {
      pressMoved.current = true;
      cancelPress();
    }
  };

  const copyEvent = async (ev: GridEvent) => {
    const data = await eventCopyData(ev.eventId);
    if (!data) return;
    // Default the duplicate to the day the copied occurrence sits on.
    openAt({ ...data, date: ev.dayISO });
  };

  const editEvent = async (ev: GridEvent) => {
    const data = await eventCopyData(ev.eventId);
    if (!data) return;
    openEdit(
      { ...data, date: ev.dayISO },
      {
        eventId: ev.eventId,
        occurrenceISO: ev.dayISO,
        recurring: ev.recurring,
      },
    );
  };

  const removeEvent = async (ev: GridEvent) => {
    const msg = ev.recurring
      ? `Delete "${ev.title}" and every repeat of it?`
      : `Delete "${ev.title}"?`;
    if (!confirm(msg)) return;
    const res = await deleteEvent(ev.eventId);
    if (res.error) alert(res.error);
  };

  const menuItems = (ev: GridEvent): MenuItem[] => {
    // Birthdays generated from a profile have no event row to act on.
    if (!ev.eventId) {
      return [{ label: "Edit on the profile", disabled: true, hint: "birthday" }];
    }
    return [
      ev.external
        ? { label: "Edit", disabled: true, hint: "subscribed" }
        : { label: "Edit", onSelect: () => editEvent(ev) },
      { label: "Copy", onSelect: () => copyEvent(ev) },
      { label: "Delete", danger: true, onSelect: () => removeEvent(ev) },
    ];
  };

  const SELECTED_RING =
    "0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-ink)";

  // Drag-to-select a time range. It only starts on a double-click/tap-and-drag,
  // so a single click/tap is free to select an event or clear the selection —
  // and no selection line appears unless you actually drag.
  const [sel, setSel] = useState<{ day: string; a: number; b: number } | null>(
    null,
  );
  const dragging = useRef(false);
  const dragStart = useRef<{ day: string; min: number } | null>(null);
  const lastDown = useRef<{ t: number; x: number; y: number } | null>(null);

  const yToMin = (el: HTMLElement, clientY: number) => {
    const rect = el.getBoundingClientRect();
    const raw = ((clientY - rect.top) / HOUR_PX) * 60;
    return clamp(Math.round(raw / 15) * 15, 0, 24 * 60);
  };

  const onColDown = (iso: string, e: React.PointerEvent<HTMLDivElement>) => {
    const now = e.timeStamp;
    const prev = lastDown.current;
    const isDouble =
      prev != null &&
      now - prev.t < 400 &&
      Math.abs(e.clientX - prev.x) < 24 &&
      Math.abs(e.clientY - prev.y) < 24;
    lastDown.current = { t: now, x: e.clientX, y: e.clientY };

    if (!isDouble) return; // first click/tap: leave it for select/deselect

    dragging.current = true;
    dragStart.current = { day: iso, min: yToMin(e.currentTarget, e.clientY) };
    if (e.pointerType !== "touch")
      e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onColMove = (iso: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const min = yToMin(e.currentTarget, e.clientY);
    const start = dragStart.current;
    setSel((s) => {
      if (s && s.day === iso) return { ...s, b: min };
      if (start && start.day === iso) return { day: iso, a: start.min, b: min };
      return s;
    });
  };

  const onColUp = (iso: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    dragStart.current = null;
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
      // A real drag opens the add form pre-filled with the selected range.
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
    // Morning start (7am) for weeks other than the current one, so jumping
    // ahead shows the start of the day rather than only the afternoon.
    const MORNING = 7 * 60;
    // Today's week follows the clock into the afternoon; other weeks anchor to
    // the morning (or earlier if something starts before it).
    const base =
      todayInView && nowMin != null
        ? clamp(nowMin - 120, earliest - 60, 24 * 60 - visibleMin)
        : Math.min(earliest - 60, MORNING);
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

  // The afternoon-follow anchor reads the clock, but nowMin is null on the
  // first render (a separate effect sets it just after mount). Anchoring only
  // on [timed] therefore always took the morning branch and never followed the
  // clock. Gate the first anchor on the clock being known — or anchor at once
  // when today isn't in view, where the clock is irrelevant — and re-anchor
  // when the events change. clockReady flips false→true exactly once, so the
  // per-minute nowMin ticks don't re-anchor and yank a manual scroll back.
  const clockReady = !todayInView || nowMin != null;

  useEffect(() => {
    if (!clockReady) return;
    scrollToAnchor(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, clockReady]);

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

  const nowY = nowMin != null ? (nowMin / 60) * HOUR_PX : null;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={onScrollerDown}
        onPointerMove={onScrollerMove}
        onPointerUp={onScrollerUp}
        onPointerCancel={onScrollerUp}
        className="h-[42rem] overflow-y-auto"
        style={{ scrollbarGutter: "stable", touchAction: "none" }}
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
            const isToday = iso === todayISO;
            // Each all-day event marked to shade tints the day behind the hours.
            // Several on one day divide the column into side-by-side colour
            // bands. Today's bands are a touch darker so the current day still
            // stands out when it's shaded (e.g. a vacation over today).
            const shaded = allDay.filter((e) => e.dayISO === iso && e.shade);
            const shadePct = isToday ? 22 : 12;

            return (
              <div
                key={iso}
                onClick={() => setSelectedId(null)}
                onPointerDown={(e) => onColDown(iso, e)}
                onPointerMove={(e) => onColMove(iso, e)}
                onPointerUp={(e) => onColUp(iso, e)}
                title="Double-click and drag to block out a new event"
                className={`relative cursor-pointer select-none border-l border-hairline ${
                  selectedDay === iso ? "bg-accent/5" : ""
                }`}
              >
                {shaded.length > 0 && (
                  <div
                    className="pointer-events-none absolute inset-0 flex"
                    aria-hidden
                  >
                    {shaded.map((e) => (
                      <div
                        key={e.id}
                        className="flex-1"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${e.color} ${shadePct}%, transparent)`,
                        }}
                      />
                    ))}
                  </div>
                )}

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
                  const selected = selectedId === e.id;

                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedId(e.id);
                      }}
                      onContextMenu={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        openMenu(e, ev.clientX, ev.clientY);
                      }}
                      onPointerDown={(ev) => onEventDown(e, ev)}
                      onPointerMove={onEventMove}
                      onPointerUp={cancelPress}
                      onPointerCancel={cancelPress}
                      title={`${e.title}\n${e.timeLabel}${
                        e.location ? `\n${e.location}` : ""
                      }\n${e.ownerName}`}
                      className={`absolute cursor-pointer overflow-hidden rounded-md px-1.5 py-1 text-[0.7rem] leading-tight text-white ${
                        selected ? "z-[6]" : "shadow-sm"
                      }`}
                      style={{
                        top,
                        height,
                        left: `calc(${lane.index * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        backgroundColor: e.color,
                        boxShadow: selected ? SELECTED_RING : undefined,
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

      {menu && (
        <EventMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.ev)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
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

"use client";

import { useEffect, useRef, useState } from "react";

export type ReadingCard = {
  iso: string;
  passage: string;
  label: string;
  relative: string;
};

/**
 * The day's reading as a deck, with today in the middle.
 *
 * Position is laid out rather than scrolled to. Every card sits at the
 * centre of the stage and is pushed sideways by its distance from the
 * selection, so the selected card is centred by the CSS itself — there is no
 * scroll offset to compute and nothing that can be measured before the fonts
 * have settled. The first paint is already correct.
 *
 * The earlier version centred by setting scrollLeft after mount, which put
 * today hard against the left edge whenever the measurement ran early.
 */
export function ReadingCards({
  cards,
  todayIndex,
}: {
  cards: ReadingCard[];
  todayIndex: number;
}) {
  const [active, setActive] = useState(todayIndex);

  // A new day (or a republished plan) moves today; follow it.
  useEffect(() => setActive(todayIndex), [todayIndex]);

  const move = (delta: number) =>
    setActive((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));

  // Swipe. Pointer events cover touch, pen, and a mouse drag in one path.
  const swipeFrom = useRef<number | null>(null);

  const current = cards[active];
  if (!current) return null;

  // Cards further out than this are not rendered: they would be off stage
  // anyway, and keeping the count fixed keeps the transition cheap.
  const NEIGHBOURS = 2;

  const arrow =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-muted transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-30";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {current.relative}
          </p>
          <p className="tabular font-display text-lg font-semibold">
            {current.label}
          </p>
        </div>

        {active !== todayIndex && (
          <button
            type="button"
            onClick={() => setActive(todayIndex)}
            className="inline-flex h-9 items-center rounded-full border border-accent px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
          >
            Back to today
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={active === 0}
          aria-label="Previous day"
          className={arrow}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* The stage. Overflow is hidden so the neighbours fade off the
            edges instead of widening the page. */}
        <div
          role="group"
          aria-label="Reading days"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              move(1);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              move(-1);
            }
          }}
          onPointerDown={(e) => {
            swipeFrom.current = e.clientX;
          }}
          onPointerUp={(e) => {
            const from = swipeFrom.current;
            swipeFrom.current = null;
            if (from === null) return;
            const dx = e.clientX - from;
            if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
          }}
          style={
            {
              // One card width drives everything else. The step is a little
              // under a full width so neighbours overlap slightly and read
              // as a deck rather than a row.
              "--card": "min(21rem, 74vw)",
              "--step": "calc(var(--card) * 0.86)",
            } as React.CSSProperties
          }
          className="relative h-56 flex-1 touch-pan-y select-none overflow-hidden outline-none"
        >
          {cards.map((card, i) => {
            const offset = i - active;
            if (Math.abs(offset) > NEIGHBOURS) return null;

            const isActive = offset === 0;
            const isToday = i === todayIndex;

            return (
              <button
                key={card.iso}
                type="button"
                onClick={() => setActive(i)}
                tabIndex={isActive ? 0 : -1}
                aria-current={isActive ? "true" : undefined}
                aria-hidden={Math.abs(offset) > 1 ? true : undefined}
                style={{
                  width: "var(--card)",
                  transform: `translate(calc(-50% + var(--step) * ${offset}), -50%) scale(${
                    isActive ? 1 : 0.82
                  })`,
                  zIndex: 10 - Math.abs(offset),
                  opacity: isActive ? 1 : Math.abs(offset) === 1 ? 0.5 : 0.22,
                }}
                className={[
                  "absolute left-1/2 top-1/2 flex h-44 flex-col justify-center rounded-2xl border p-6 text-left",
                  "transition-all duration-300 ease-out",
                  isActive
                    ? "border-accent bg-surface shadow-md"
                    : "border-hairline bg-surface",
                ].join(" ")}
              >
                <span
                  className={`tabular text-xs uppercase tracking-widest ${
                    isToday ? "text-accent" : "text-muted"
                  }`}
                >
                  {card.relative}
                </span>

                <span
                  className={[
                    "font-display mt-2 break-words font-semibold leading-tight transition-all duration-300",
                    isActive ? "text-3xl" : "text-xl",
                  ].join(" ")}
                >
                  {card.passage}
                </span>

                <span className="tabular mt-3 text-sm text-muted">
                  {card.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => move(1)}
          disabled={active === cards.length - 1}
          aria-label="Next day"
          className={arrow}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </section>
  );
}

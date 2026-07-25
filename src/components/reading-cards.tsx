"use client";

import { useEffect, useRef, useState } from "react";

export type ReadingCard = {
  iso: string;
  passage: string;
  /** Full date, e.g. "Sunday, July 26, 2026". */
  label: string;
};

/**
 * A relative day name for an offset in days. Each card is named by its own
 * distance from the real today, so the labels stay glued to their dates:
 * scroll right and the "Today" card slides off to the left while "Tomorrow"
 * takes the centre. They only change when the actual day rolls over.
 */
function relativeLabel(offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  if (offset > 1) return `In ${offset} days`;
  return `${Math.abs(offset)} days ago`;
}

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

  const swipeFrom = useRef<number | null>(null);

  const current = cards[active];
  if (!current) return null;

  // Only the focused card and its immediate neighbours are rendered fully;
  // one more each side peeks in to hint the deck continues.
  const NEIGHBOURS = 2;

  const arrow =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-muted transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-30";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          {/* The header is the anchor to the real today — this is what makes
              "Back to today" meaningful. */}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {relativeLabel(active - todayIndex)}
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
              // A narrower card and a near-full step keep both immediate
              // neighbours clear of the centre, so yesterday's reading can be
              // read in full rather than tucked behind today.
              "--card": "min(16rem, 78vw)",
              "--step": "calc(var(--card) * 0.9)",
            } as React.CSSProperties
          }
          className="relative h-52 flex-1 touch-pan-y select-none overflow-hidden outline-none"
        >
          {cards.map((card, i) => {
            const offset = i - active;
            if (Math.abs(offset) > NEIGHBOURS) return null;

            const isActive = offset === 0;
            const distance = Math.abs(offset);

            return (
              <button
                key={card.iso}
                type="button"
                onClick={() => setActive(i)}
                tabIndex={isActive ? 0 : -1}
                aria-current={isActive ? "true" : undefined}
                aria-hidden={distance > 1 ? true : undefined}
                style={{
                  width: "var(--card)",
                  transform: `translate(calc(-50% + var(--step) * ${offset}), -50%) scale(${
                    isActive ? 1 : 0.82
                  })`,
                  zIndex: 10 - distance,
                  opacity: isActive ? 1 : distance === 1 ? 0.7 : 0.25,
                }}
                className={[
                  "absolute left-1/2 top-1/2 flex h-44 flex-col justify-center rounded-2xl border p-5 text-left",
                  "transition-all duration-300 ease-out",
                  isActive
                    ? "border-accent bg-surface shadow-md"
                    : "border-hairline bg-surface",
                ].join(" ")}
              >
                <span
                  className={`tabular text-xs uppercase tracking-widest ${
                    isActive ? "text-accent" : "text-muted"
                  }`}
                >
                  {relativeLabel(i - todayIndex)}
                </span>

                <span
                  className={[
                    "font-display mt-2 break-words font-semibold leading-tight transition-all duration-300",
                    isActive ? "text-3xl" : "text-lg",
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

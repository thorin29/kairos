"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ReadingCard = {
  iso: string;
  passage: string;
  label: string;
  relative: string;
};

/**
 * The day's reading as a deck. The centred card is large and legible from
 * across a room; neighbours sit smaller either side, so what's coming and
 * what was missed are visible without leaving today.
 *
 * Scrolling drives the state rather than the other way round — the container
 * snaps, and the nearest card to centre becomes the selection. That way a
 * swipe on a phone and a click on a laptop go through the same path.
 */
export function ReadingCards({
  cards,
  todayIndex,
}: {
  cards: ReadingCard[];
  todayIndex: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(todayIndex);

  const centre = useCallback((index: number, smooth = true) => {
    const el = track.current?.children[index] as HTMLElement | undefined;
    if (!el || !track.current) return;

    track.current.scrollTo({
      left: el.offsetLeft - (track.current.clientWidth - el.clientWidth) / 2,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Start on today without animating in from the left.
  useEffect(() => {
    centre(todayIndex, false);
  }, [centre, todayIndex]);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;

    const middle = el.scrollLeft + el.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;

    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const distance = Math.abs(c.offsetLeft + c.clientWidth / 2 - middle);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });

    setActive(nearest);
  };

  const current = cards[active];

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {current?.relative}
          </p>
          <p className="tabular font-display text-lg font-semibold">
            {current?.label}
          </p>
        </div>

        {active !== todayIndex && (
          <button
            type="button"
            onClick={() => centre(todayIndex)}
            className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Back to today
          </button>
        )}
      </div>

      <div
        ref={track}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card, i) => {
          const isActive = i === active;
          const isToday = i === todayIndex;

          return (
            <button
              key={card.iso}
              type="button"
              onClick={() => centre(i)}
              aria-current={isActive ? "true" : undefined}
              className={[
                "flex w-[78%] shrink-0 snap-center flex-col justify-center rounded-2xl border p-6 text-left",
                "transition-all duration-300 ease-out sm:w-[22rem]",
                isActive
                  ? "scale-100 border-accent bg-surface opacity-100 shadow-md"
                  : "scale-90 border-hairline bg-surface/70 opacity-55 hover:opacity-80",
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
                  "font-display mt-2 font-semibold leading-tight transition-all duration-300",
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
    </section>
  );
}

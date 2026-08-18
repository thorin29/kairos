"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, todayISO, formatLong } from "@/lib/dates";
import { CATEGORY_LABELS } from "@/lib/colors";
import { personDayLog, type DayLogItem } from "@/lib/actions/day-log";
import { CheckIcon } from "@/components/icons";

/** Wraps a summary person card; tapping it opens a popup of what they actually
 *  did that day, with day-to-day scrolling. */
export function DayLogCard({
  userId,
  name,
  children,
}: {
  userId: string;
  name: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0); // 0 = today, -1 = yesterday…
  const [data, setData] = useState<{
    items: DayLogItem[];
    doneCount: number;
    assigned: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const dayISO = addDays(todayISO(), offset);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    personDayLog(userId, dayISO).then((r) => {
      if (live) {
        setData(r);
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [open, dayISO, userId]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setOffset(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className="cursor-pointer rounded-3xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent"
      >
        {children}
      </div>

      {open &&
        createPortal(
          <div
            className="animate-backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{name}</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted hover:text-ink"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>

              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setOffset((o) => o - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-muted hover:border-accent hover:text-accent"
                  aria-label="Previous day"
                >
                  &lsaquo;
                </button>
                <span className="text-sm font-medium">
                  {offset === 0 ? "Today" : offset === -1 ? "Yesterday" : formatLong(dayISO)}
                </span>
                <button
                  type="button"
                  disabled={offset >= 0}
                  onClick={() => setOffset((o) => Math.min(0, o + 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-muted hover:border-accent hover:text-accent disabled:opacity-30"
                  aria-label="Next day"
                >
                  &rsaquo;
                </button>
              </div>

              {loading || !data ? (
                <p className="py-6 text-center text-sm text-muted">Loading…</p>
              ) : data.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  Nothing scheduled this day.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted">
                    {data.doneCount} of {data.assigned} done
                  </p>
                  <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                    {data.items.map((it, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        {it.skipped ? (
                          <span className="h-4 w-4 shrink-0 text-center text-xs text-muted">—</span>
                        ) : it.done ? (
                          <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <span className="h-4 w-4 shrink-0 rounded-full border border-hairline" />
                        )}
                        <span
                          className={
                            it.done
                              ? ""
                              : it.skipped
                                ? "text-muted line-through"
                                : "text-muted"
                          }
                        >
                          {it.title}
                        </span>
                        <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-muted">
                          {CATEGORY_LABELS[it.category as keyof typeof CATEGORY_LABELS] ?? it.category}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

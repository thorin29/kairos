"use client";

import Link from "next/link";
import { useState } from "react";
import { monthGridDays, isSameMonth, startOfMonth } from "@/lib/dates";
import { ChevronDownIcon } from "@/components/icons";

const INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * The heading month name, tappable: it drops a small month calendar (single
 * letter weekdays, a few coloured dots on days that have events) for jumping
 * to any day. Shown on the non-month views; tapping a day navigates there in
 * the current view. Days from the neighbouring months are tappable too, so
 * there's no need for separate month arrows.
 */
export function MonthDropdown({
  label,
  monthISO,
  todayISO,
  currentDate,
  dotsByDay,
  dayHref,
}: {
  label: string;
  monthISO: string;
  todayISO: string;
  currentDate: string;
  dotsByDay: Record<string, string[]>;
  dayHref: (iso: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const month = startOfMonth(monthISO);
  const cells = monthGridDays(month);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg text-left transition-colors hover:text-accent"
      >
        <span className="font-display text-xl font-semibold tracking-tight">
          {label}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-2xl border border-hairline bg-ground p-3 shadow-xl">
            <div className="grid grid-cols-7 gap-y-0.5">
              {INITIALS.map((d, i) => (
                <span
                  key={i}
                  className="pb-1 text-center text-[0.6rem] font-semibold uppercase text-muted"
                >
                  {d}
                </span>
              ))}
              {cells.map((iso) => {
                const inMonth = isSameMonth(iso, month);
                const isToday = iso === todayISO;
                const isCurrent = iso === currentDate;
                const dots = dotsByDay[iso] ?? [];
                return (
                  <Link
                    key={iso}
                    href={dayHref(iso)}
                    onClick={() => setOpen(false)}
                    className="mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full transition-colors hover:bg-ground"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isToday
                          ? "bg-accent font-semibold text-white"
                          : isCurrent
                            ? "ring-1 ring-accent"
                            : ""
                      } ${inMonth ? "" : "text-muted/50"}`}
                    >
                      {Number(iso.slice(8, 10))}
                    </span>
                    <span className="mt-0.5 flex h-1 items-center gap-0.5">
                      {dots.map((c, i) => (
                        <span
                          key={i}
                          className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

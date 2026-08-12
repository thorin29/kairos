"use client";

import { useState, useTransition } from "react";
import type { HolidayRow, HolidayGroup } from "@/lib/holidays";
import { saveHolidays } from "@/lib/actions/holidays";
import { Card } from "@/components/ui";

const GROUP_ORDER: HolidayGroup[] = [
  "Federal",
  "Texas",
  "Religious",
  "Observance",
  "Seasonal",
];

/** Per-holiday on/off toggles, grouped, saving the whole set on each change. */
export function Holidays({ rows }: { rows: HolidayRow[] }) {
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.enabled).map((r) => r.key)),
  );
  const [, start] = useTransition();

  const toggle = (key: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      start(() => void saveHolidays([...next]));
      return next;
    });
  };

  const setMany = (keys: string[], on: boolean) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      start(() => void saveHolidays([...next]));
      return next;
    });
  };

  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    items: rows.filter((r) => r.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Holidays are computed for every year, so they never stop at year&rsquo;s
        end. Turn on exactly the ones you want; they show as all-day items in a
        shared colour.
      </p>

      {groups.map(({ group, items }) => {
        const keys = items.map((i) => i.key);
        const allOn = items.every((i) => enabled.has(i.key));
        return (
          <div key={group}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-display text-sm font-semibold uppercase tracking-widest text-muted">
                {group}
              </h4>
              <button
                type="button"
                onClick={() => setMany(keys, !allOn)}
                className="text-xs font-medium text-accent hover:underline"
              >
                {allOn ? "Turn all off" : "Turn all on"}
              </button>
            </div>
            <Card className="divide-y divide-hairline">
              {items.map((h) => {
                const on = enabled.has(h.key);
                return (
                  <button
                    key={h.key}
                    type="button"
                    onClick={() => toggle(h.key)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <span
                      className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                        on ? "bg-accent" : "bg-ink/15"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          on ? "translate-x-4" : ""
                        }`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {h.label}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted">
                      {formatNext(h.nextISO)}
                    </span>
                  </button>
                );
              })}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function formatNext(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

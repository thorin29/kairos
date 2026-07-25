"use client";

import { useMemo, useState, useTransition } from "react";
import { BOOKS, type Group } from "@/lib/bible/books";
import { setBookRead, setBooksRead } from "@/lib/actions/reading";
import { Card } from "@/components/ui";
import { CheckIcon, TrophyIcon } from "@/components/icons";

const GROUPS: Group[] = [
  "Pentateuch",
  "History",
  "Wisdom",
  "Major Prophets",
  "Minor Prophets",
  "Gospels",
  "Acts",
  "Paul",
  "General Epistles",
  "Revelation",
];

export function BookProgress({ initial }: { initial: string[] }) {
  const [done, setDone] = useState<Set<string>>(() => new Set(initial));
  const [, startTransition] = useTransition();

  const total = BOOKS.length;
  const count = done.size;
  const allDone = count === total;

  const otNames = useMemo(
    () => BOOKS.filter((b) => b.testament === "OT").map((b) => b.name),
    [],
  );
  const ntNames = useMemo(
    () => BOOKS.filter((b) => b.testament === "NT").map((b) => b.name),
    [],
  );

  const toggle = (name: string) => {
    const read = !done.has(name);
    setDone((prev) => {
      const next = new Set(prev);
      if (read) next.add(name);
      else next.delete(name);
      return next;
    });
    startTransition(() => setBookRead(name, read));
  };

  const bulk = (names: string[], read: boolean) => {
    setDone((prev) => {
      const next = new Set(prev);
      for (const n of names) {
        if (read) next.add(n);
        else next.delete(n);
      }
      return next;
    });
    startTransition(() => setBooksRead(names, read));
  };

  const chip =
    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors";

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-sm text-muted">
          {count} of {total} books marked read
        </p>
        {allDone && (
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">
            <TrophyIcon className="h-4 w-4" />
            Whole Bible
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => bulk(otNames, true)}
          className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
        >
          Mark Old Testament read
        </button>
        <button
          type="button"
          onClick={() => bulk(ntNames, true)}
          className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
        >
          Mark New Testament read
        </button>
        {count > 0 && (
          <button
            type="button"
            onClick={() => bulk(BOOKS.map((b) => b.name), false)}
            className={`${chip} border-hairline text-muted hover:border-red-300 hover:text-red-700`}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-4">
        {GROUPS.map((group) => {
          const books = BOOKS.filter((b) => b.group === group);
          return (
            <div key={group}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
                {group}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {books.map((b) => {
                  const on = done.has(b.name);
                  return (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => toggle(b.name)}
                      aria-pressed={on}
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        on
                          ? "border-accent bg-accent text-white"
                          : "border-hairline text-muted hover:border-accent",
                      ].join(" ")}
                    >
                      {on && <CheckIcon className="h-3.5 w-3.5" />}
                      {b.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

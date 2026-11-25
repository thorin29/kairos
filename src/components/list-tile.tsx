"use client";

import { useTransition, type ReactNode } from "react";
import { toggleTask } from "@/lib/actions/tasks";
import { markPersonalReading } from "@/lib/actions/personal-plan";
import { formatShort } from "@/lib/dates";
import { HomeTile } from "@/components/home-tile";

export type ListTileLine = {
  id: string;
  title: string;
  sub?: string | null;
  done: boolean;
  late: boolean;
  dueISO: string;
};

/**
 * A list area (Bible, Tasks) as a home tile (v0.799): each line checks off
 * with a tap (tap again to undo); the tile's name opens the area's page.
 */
export function ListTile({
  icon,
  color,
  label,
  lines,
  personal,
  href,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  lines: ListTileLine[];
  /** The person's own Bible plan for today, as one more line. */
  personal?: { userId: string; passage: string; dayISO: string; read: boolean } | null;
  /** The area's own page (v0.800), opened from the tile's name. */
  href?: string;
}) {
  const [pending, start] = useTransition();
  const all = [
    ...lines.map((l) => ({ ...l, tap: () => start(() => void toggleTask(l.id)) })),
    ...(personal
      ? [
          {
            id: "personal",
            title: personal.passage,
            sub: "Personal reading",
            done: personal.read,
            late: false,
            dueISO: personal.dayISO,
            tap: () => start(() => void markPersonalReading(personal.userId, personal.passage, !personal.read, personal.dayISO)),
          },
        ]
      : []),
  ];
  const late = all.filter((l) => l.late && !l.done).length;
  const allDone = all.length > 0 && all.every((l) => l.done);

  const line = (l: (typeof all)[number], tappable: boolean) => {
    const body = (
      <>
        <span
          aria-hidden
          className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 text-[10px] font-bold ${
            l.done ? "border-emerald-600 bg-emerald-600 text-white" : ""
          }`}
          style={l.done ? undefined : { borderColor: color }}
        >
          {l.done ? "✓" : ""}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] font-semibold ${l.done ? "text-muted line-through" : ""}`}>{l.title}</span>
          {(l.sub || (l.late && !l.done)) && (
            <span className="block truncate text-xs text-muted">
              {l.sub}
              {l.late && !l.done && (
                <span className="tabular font-medium text-red-700">
                  {l.sub ? " · " : ""}due {formatShort(l.dueISO)}
                </span>
              )}
            </span>
          )}
        </span>
      </>
    );
    return tappable ? (
      <button
        key={l.id}
        type="button"
        disabled={pending}
        onClick={l.tap}
        aria-label={l.done ? `Mark ${l.title} not done` : `Mark ${l.title} done`}
        className="flex w-full items-start gap-2 rounded-lg text-left hover:bg-ground/60 disabled:opacity-60"
      >
        {body}
      </button>
    ) : (
      <span key={l.id} className="flex items-start gap-2">
        {body}
      </span>
    );
  };

  return (
    <div className={pending ? "opacity-70" : undefined}>
      <HomeTile
        icon={icon}
        color={color}
        label={label}
        state={allDone ? "done" : late ? "overdue" : "normal"}
        badge={late ? String(late) : null}
        headerHref={href}
      >
        {all.slice(0, 4).map((l) => line(l, true))}
        {all.length > 4 && <span className="text-xs text-muted">+{all.length - 4} more</span>}
      </HomeTile>
    </div>
  );
}

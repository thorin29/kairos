"use client";

import type { ComponentType, ReactNode } from "react";

type IconType = ComponentType<{ className?: string }>;

/**
 * A Workouts menu button: an icon over its label, three to a row (v0.684:
 * shared so Family WOD and Pause match Edit plan and the rest).
 */
export function ActionButton({
  icon: Icon,
  label,
  sub,
  onClick,
  primary,
}: {
  icon: IconType;
  label: string;
  /** A smaller line under the label ("Create / edit"). */
  sub?: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors ${
        primary
          ? "border-accent bg-accent/10 text-accent"
          : "border-accent bg-surface text-ink hover:bg-accent/10 hover:text-accent"
      }`}
    >
      <Icon className="h-6 w-6" />
      {label}
      {sub && <span className="-mt-1 text-[11px] font-medium text-muted">{sub}</span>}
    </button>
  );
}

/** A group of the page's buttons (v0.786): a tinted band with the group's
 *  name, then its buttons, on a white card like the program tile. */
export function ActionGroup({ kind, title, children }: { kind: string; title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <TileHeader kind={kind} title={title} trailing="" solid={false} />
      <div className="grid auto-cols-fr grid-flow-col gap-2 p-3">{children}</div>
    </section>
  );
}

/** The plan tile's header band (v0.784): PROGRAM or PLAN, the name, and its
 *  week (or end date) on the right. */
export function TileHeader({ kind, title, trailing, solid = true }: { kind: string; title: string; trailing: string; solid?: boolean }) {
  // A group's band (v0.786) is the accent tint with accent type; the program's is solid.
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 ${solid ? "bg-accent text-on-accent" : "bg-accent/10 text-accent"}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-85">{kind}</span>
      <span className="min-w-0 flex-1 truncate font-display text-base font-bold">{title}</span>
      <span className="shrink-0 text-xs opacity-90">{trailing}</span>
    </div>
  );
}


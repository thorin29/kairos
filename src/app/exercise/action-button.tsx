"use client";

import type { ComponentType } from "react";

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
          : "border-hairline text-ink hover:border-accent hover:text-accent"
      }`}
    >
      <Icon className="h-6 w-6" />
      {label}
      {sub && <span className="-mt-1 text-[11px] font-medium text-muted">{sub}</span>}
    </button>
  );
}

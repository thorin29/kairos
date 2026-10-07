"use client";

import { useMemo } from "react";
import {
  BACK_OUTLINES,
  BACK_PATHS,
  BACK_VIEWBOX,
  FRONT_OUTLINES,
  FRONT_PATHS,
  FRONT_VIEWBOX,
  type BodyPath,
} from "@/components/body-map-paths";
import { NAV_LABEL, type NavRegion } from "@/lib/workouts/involvement";

export type { NavRegion };

/**
 * The clickable body. Two figures, one tap target per region.
 *
 * Two separate ideas live here and they are deliberately not the same field:
 *
 *   SELECTION  — `nav`. Which target a click resolves to. One per region.
 *   SHADING    — `group`. Which muscle group the region lights up as.
 *
 * A deadlift is why. Tapping the lower back or the glutes selects it, but
 * those pixels shade as Core (obliques, lumbar erectors) and Legs (glutes) —
 * the lower back being part of the core, not a thing apart from it. Forcing
 * one field to do both jobs is what made the deadlift impossible to file.
 */

/** Which figure a view shows. A deadlift is posterior-only; a squat is both. */
export type BodyView = "front" | "back" | "both";

type Props = {
  /** The tap target currently selected, if any. */
  selected?: NavRegion | null;
  onSelect?: (nav: NavRegion) => void;
  /** Groups to shade strongly — what the shown movements work directly. */
  primary?: string[];
  /** Groups to shade faintly — what they also work. */
  secondary?: string[];
  /** Which figures to draw. "both" is the default and right for most. */
  view?: BodyView;
  /** Tap targets that have nothing behind them are drawn inert. */
  available?: NavRegion[];
  className?: string;
};

function Figure({
  paths,
  outlines,
  box,
  selected,
  onSelect,
  primary,
  secondary,
  available,
  label,
}: {
  paths: BodyPath[];
  outlines: Record<string, string>;
  box: { w: number; h: number };
  selected?: NavRegion | null;
  onSelect?: (nav: NavRegion) => void;
  primary: Set<string>;
  secondary: Set<string>;
  available: Set<NavRegion> | null;
  label: string;
}) {
  const seen = new Set<NavRegion>();
  return (
    <svg
      viewBox={`0 0 ${box.w} ${box.h}`}
      className="h-auto w-full max-w-[200px]"
      role="group"
      aria-label={label}
    >
      {paths.map((p, i) => {
        const nav = p.nav as NavRegion | null;
        const inert = !p.group || !nav;
        const live = !inert && (!available || available.has(nav!));
        // One tab stop per TARGET, not per path. Legs alone is thirteen
        // regions; making each focusable would put seventy stops between the
        // keyboard and the rest of the page.
        const firstOfTarget = live && !seen.has(nav!);
        if (firstOfTarget) seen.add(nav!);

        // Shading is by GROUP; selection is by NAV. A region can be selected
        // and unshaded, or shaded without being the thing you clicked.
        const fill = inert
          ? "var(--hairline)"
          : primary.has(p.group!)
            ? "var(--accent)"
            : secondary.has(p.group!)
              ? "color-mix(in srgb, var(--accent) 34%, var(--surface))"
              : "var(--hairline)";
        return (
          <path
            key={i}
            d={p.d}
            fill={fill}
            className={
              live
                ? "cursor-pointer outline-none transition-[fill] focus-visible:stroke-accent"
                : undefined
            }
            onClick={live ? () => onSelect?.(nav!) : undefined}
            tabIndex={firstOfTarget ? 0 : -1}
            role={firstOfTarget ? "button" : undefined}
            onKeyDown={
              firstOfTarget
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(nav!);
                    }
                  }
                : undefined
            }
            aria-label={firstOfTarget ? NAV_LABEL[nav!] : undefined}
          />
        );
      })}
      {selected && outlines[selected] && (
        <path
          d={outlines[selected]}
          fill="none"
          stroke="var(--fg)"
          strokeWidth={5}
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

export default function BodyMap({
  selected,
  onSelect,
  primary = [],
  secondary = [],
  view = "both",
  available,
  className,
}: Props) {
  const pri = useMemo(() => new Set(primary), [primary]);
  const sec = useMemo(() => new Set(secondary), [secondary]);
  const avail = useMemo(
    () => (available ? new Set(available) : null),
    [available],
  );

  const showFront = view === "front" || view === "both";
  const showBack = view === "back" || view === "both";

  return (
    <div className={`flex items-start justify-center gap-4 ${className ?? ""}`}>
      {showFront && (
        <Figure
          paths={FRONT_PATHS}
          outlines={FRONT_OUTLINES}
          box={FRONT_VIEWBOX}
          selected={selected}
          onSelect={onSelect}
          primary={pri}
          secondary={sec}
          available={avail}
          label="Front of the body"
        />
      )}
      {showBack && (
        <Figure
          paths={BACK_PATHS}
          outlines={BACK_OUTLINES}
          box={BACK_VIEWBOX}
          selected={selected}
          onSelect={onSelect}
          primary={pri}
          secondary={sec}
          available={avail}
          label="Back of the body"
        />
      )}
    </div>
  );
}

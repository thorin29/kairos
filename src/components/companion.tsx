"use client";

import { COMPANIONS, stageAsset, STAGE_NAMES, STAGE_SPANS } from "@/lib/companions";
import { XpBar } from "@/components/xp-bar";

const MYSTERY_EGG = "/companions/eggs/mystery.png";
/** The one shiny colour, shared by the card, the name and the app. */
const SHINY = "#f5b400";

export type CompanionView = {
  active: boolean;
  species: string | null;
  stage: number;
  shiny: boolean;
  /** growing | adult | deepening | shiny — what the bar is measuring. */
  phase: "growing" | "adult" | "deepening" | "shiny";
  incubationPct: number;
  eggReady: boolean;
  eggCapped: boolean;
  luck: number;
};

/**
 * A person's companion card. While it's an egg, the sprite is the egg and a
 * little meter shows incubation; once hatched, it's the creature at its current
 * evolution stage. The card glow is the skill-blend fingerprint either way.
 */
export function Companion({
  companion,
  colorHex,
  size = "md",
  pct,
  shares,
}: {
  companion: CompanionView;
  colorHex: string;
  size?: "sm" | "md";
  pct?: number;
  shares?: Record<string, number>;
}) {
  const sp = companion.species ? COMPANIONS[companion.species] : null;
  const asset =
    companion.active && sp ? stageAsset(sp.id, companion.stage) : MYSTERY_EGG;

  const box = size === "sm" ? "h-14 w-24 shrink-0" : "min-h-[9rem] w-full max-w-[16rem]";
  const imgBox = size === "sm" ? "h-9" : "h-24";
  // Text-free odds cue: the egg meter glows in the rarity colour the current
  // streak is unlocking — plain slate, then blue, purple, gold as luck climbs.
  const luckColor =
    companion.luck >= 0.75
      ? "#eab308" // legendary — gold
      : companion.luck >= 0.5
        ? "#7c3aed" // rare — purple
        : companion.luck >= 0.25
          ? "#2563eb" // uncommon — blue
          : "#94a3b8"; // low streak — slate

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-2xl border p-2 ${box}`}
      style={{
        borderColor: `${colorHex}66`,
        background: `radial-gradient(120% 120% at 50% 15%, ${colorHex}1f, transparent 70%)`,
        boxShadow: `0 0 22px ${colorHex}33`,
      }}
    >
      {companion.shiny && companion.active && (
        <span
          className="pointer-events-none absolute right-2 top-1.5 text-sm"
          style={{ color: SHINY, textShadow: `0 0 6px ${SHINY}` }}
          title="Shiny"
        >
          &#10022;
        </span>
      )}

      {/* A shiny creature is lit from behind and gilded, so it reads as rare at a
          glance rather than needing the star to be noticed. The egg is never
          shiny — only what hatched from it. */}
      <div className="relative flex items-center justify-center">
        {companion.shiny && companion.active && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -m-3 rounded-full"
            style={{ background: `radial-gradient(circle, ${SHINY}59, transparent 68%)` }}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset}
          alt={companion.active && sp ? sp.name : "Incubating egg"}
          className={`relative ${imgBox} ${companion.active ? "companion-idle" : companion.eggReady ? "companion-thrive" : ""} pixelated max-w-full w-auto object-contain`}
          style={
            companion.shiny && companion.active
              ? { filter: `drop-shadow(0 0 5px ${SHINY}) saturate(1.2) brightness(1.06)` }
              : undefined
          }
          draggable={false}
        />
      </div>

      {size !== "sm" && (
        <div className="mt-1.5 flex flex-col items-center gap-1.5">
          {companion.active && sp ? (
            <>
              <p className="text-sm font-semibold" style={companion.shiny ? { color: SHINY } : undefined}>
                {sp.name}{" "}
                <span className="font-normal text-muted">
                  &middot; {STAGE_NAMES[companion.stage]}
                </span>
              </p>
              {/* ONE row of cells. It fills with GROWTH and breaks at each
                  stage, so the squares tie directly to raising the creature
                  rather than needing a second rail underneath saying so. The
                  colours still come from what earned it, which was always the
                  point of them. */}
              {shares && (
                <XpBar
                  pct={companion.incubationPct}
                  shares={shares}
                  gapsAfter={growthCellGaps()}
                />
              )}
              {/* Deepening is the exception: a smaller, separate job, so it gets
                  its own short rail in place of nothing rather than reusing the
                  stage row, which is about growth it has already finished. */}
              {companion.phase === "deepening" && (
                <PhaseBar companion={companion} luckColor={luckColor} />
              )}
              {companion.eggReady && (
                <p className="text-[0.65rem] font-medium text-emerald-700">
                  A new egg is ready!
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Ready to hatch!</p>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-hairline">
                <div
                  className="h-full rounded-full"
                  style={{ width: "100%", background: luckColor }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The deepening rail: one short bar, shown only while a companion is being
 * deepened.
 *
 * Deliberately narrower than the stage row above it. Deepening is a smaller,
 * separate job, and at full width it looked like the growth journey starting
 * over.
 */
function PhaseBar({
  companion,
  luckColor,
}: {
  companion: CompanionView;
  luckColor: string;
}) {
  return (
    <div className="flex w-20 flex-col items-center gap-0.5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full"
          style={{ width: `${companion.incubationPct}%`, background: luckColor }}
        />
      </div>
      <p className="text-[0.65rem] font-medium text-muted">deepening</p>
    </div>
  );
}

/**
 * Which cells of the 20 get a divider after them, from the stage spans.
 *
 * Derived rather than hardcoded: the thresholds live in CLEAN_DAY_STAGES, and a
 * divider drawn at a different place than the stage actually ends would be
 * worse than no divider at all.
 */
function growthCellGaps(): number[] {
  const CELLS = 20;
  const out: number[] = [];
  let acc = 0;
  for (const span of STAGE_SPANS.slice(0, -1)) {
    acc += span;
    out.push(Math.round((acc / 100) * CELLS));
  }
  return out;
}

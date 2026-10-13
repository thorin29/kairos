"use client";

import { COMPANIONS, stageAsset, STAGE_NAMES, STAGE_TICK_PCT } from "@/lib/companions";

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
              {/* ONE bar, measuring the phase it is in. The card used to show
                  the skill-blend XP bar here and the egg meter below it, and
                  neither of them was the thing people read it as — how grown
                  the creature is. */}
              <PhaseBar companion={companion} luckColor={luckColor} />
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
 * The one bar on the card: progress through whatever the companion is doing
 * now, with a tick where each stage begins.
 *
 * The ticks carry no labels on purpose — they show the shape of the journey
 * (two marks, three stages) without a legend a child has to be taught. They
 * only appear while growing, because once a companion is grown the bar is
 * measuring something else and a stage mark on it would be a lie.
 */
function PhaseBar({
  companion,
  luckColor,
}: {
  companion: CompanionView;
  luckColor: string;
}) {
  const growing = companion.phase === "growing";
  const caption =
    companion.phase === "growing"
      ? "growing"
      : companion.phase === "deepening"
        ? "deepening"
        : companion.phase === "shiny"
          ? "deepened \u2014 a new egg is ready!"
          : "fully grown \u2014 a new egg is ready!";

  return (
    <div className="flex w-32 flex-col items-center gap-0.5">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full"
          style={{
            width: `${companion.incubationPct}%`,
            background: companion.phase === "shiny" ? SHINY : luckColor,
          }}
        />
        {growing &&
          STAGE_TICK_PCT.filter((t) => t < 100).map((t) => (
            <span
              key={t}
              className="absolute top-0 h-full w-px bg-surface/80"
              style={{ left: `${t}%` }}
            />
          ))}
      </div>
      <p
        className="text-[0.65rem] font-medium"
        style={companion.eggReady ? { color: "#047857" } : undefined}
      >
        {caption}
      </p>
    </div>
  );
}

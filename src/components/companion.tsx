"use client";

import { COMPANIONS, stageAsset, STAGE_NAMES } from "@/lib/companions";
import { XpBar } from "@/components/xp-bar";

const MYSTERY_EGG = "/companions/eggs/mystery.png";

export type CompanionView = {
  active: boolean;
  species: string | null;
  stage: number;
  shiny: boolean;
  incubationPct: number;
  eggReady: boolean;
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

  const box = size === "sm" ? "h-14 w-24 shrink-0" : "h-36 w-full max-w-[16rem]";
  const imgBox = size === "sm" ? "h-9" : "h-24";

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-2xl border p-2 ${box}`}
      style={{
        borderColor: `${colorHex}66`,
        background: `radial-gradient(120% 120% at 50% 15%, ${colorHex}1f, transparent 70%)`,
        boxShadow: `0 0 22px ${colorHex}33`,
      }}
    >
      {companion.shiny && (
        <span className="absolute right-2 top-1.5 text-sm" title="Shiny">
          &#10022;
        </span>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset}
        alt={companion.active && sp ? sp.name : "Incubating egg"}
        className={`${imgBox} ${companion.active ? "companion-idle" : companion.eggReady ? "companion-thrive" : ""} pixelated max-w-full w-auto object-contain`}
        draggable={false}
      />

      {size !== "sm" && (
        <div className="mt-1.5 flex flex-col items-center gap-1.5">
          {companion.active && sp ? (
            <>
              <p className="text-sm font-semibold">
                {sp.name}{" "}
                <span className="font-normal text-muted">
                  &middot; {STAGE_NAMES[companion.stage]}
                </span>
              </p>
              {pct != null && shares && <XpBar pct={pct} shares={shares} />}
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">
                {companion.eggReady ? "Ready to hatch!" : "Egg"}
              </p>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-hairline">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${companion.incubationPct}%`, background: colorHex }}
                />
              </div>
              <p className="tabular text-xs text-muted">{companion.incubationPct}% incubated</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

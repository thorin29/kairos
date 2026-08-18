"use client";

import {
  COMPANIONS,
  DEFAULT_COMPANION,
  stageForLevel,
  stageAsset,
  moodForStreak,
  STAGE_NAMES,
} from "@/lib/companions";
import { XpBar } from "@/components/xp-bar";

/**
 * A person's companion: the creature sprite at its current evolution stage,
 * inside a card whose glow is tinted by that person's skill-blend colour (the
 * fingerprint lives on the frame so it works across every art era). The idle
 * animation is a gentle mood — bouncy when thriving, napping when the streak's
 * asleep — never punishing.
 */
export function Companion({
  species = DEFAULT_COMPANION,
  colorHex,
  level,
  streak,
  size = "md",
  pct,
  shares,
}: {
  species?: string;
  colorHex: string;
  level: number;
  streak: number;
  size?: "sm" | "md";
  pct?: number;
  shares?: Record<string, number>;
}) {
  const sp = COMPANIONS[species] ?? COMPANIONS[DEFAULT_COMPANION];
  const stage = stageForLevel(level);
  const mood = moodForStreak(streak);
  const asset = stageAsset(species, stage);

  const anim =
    mood === "thriving" ? "companion-thrive" : mood === "sleepy" ? "companion-nap" : "companion-idle";

  const box =
    size === "sm" ? "h-14 w-24 shrink-0" : "h-36 w-full max-w-[16rem]";
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
      {/* sleepy Zzz */}
      {mood === "sleepy" && size !== "sm" && (
        <span className="companion-zzz absolute right-6 top-3 text-sm font-bold text-muted">z</span>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset}
        alt={`${sp.name} (${STAGE_NAMES[stage]})`}
        className={`${imgBox} ${anim} pixelated max-w-full w-auto object-contain`}
        draggable={false}
      />

      {size !== "sm" && (
        <div className="mt-1.5 flex flex-col items-center gap-1.5">
          <p className="text-sm font-semibold">
            {sp.name}{" "}
            <span className="font-normal text-muted">
              &middot; {STAGE_NAMES[stage]} &middot; Lv {level}
            </span>
          </p>
          {pct != null && shares && <XpBar pct={pct} shares={shares} />}
        </div>
      )}
    </div>
  );
}

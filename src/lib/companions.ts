/**
 * Companions — the collectible creature layer. This module is the roster config
 * plus the pure rules for how a companion looks. Dependency-free so the display
 * component and the server can share it.
 *
 * For now everyone has the same starter companion (Coincroc), derived entirely
 * from progression — its stage grows with your level, its card glows with your
 * skill-blend colour, its mood follows your streak. When the collection lands
 * (random eggs, shinies, essence), the *species* becomes per-user and stored;
 * everything here stays the same.
 */

export type CompanionEra = "MODERN" | "TOON" | "ARCADE" | "VINTAGE";

export type CompanionSpecies = {
  id: string;
  name: string;
  era: CompanionEra;
  rarity: "common" | "uncommon" | "rare" | "legendary";
  /** Public asset folder holding hatchling/juvenile/adult PNGs. */
  assetBase: string;
};

/** The roster. Add creatures here as the art arrives — it's just rows. */
export const COMPANIONS: Record<string, CompanionSpecies> = {
  coincroc: {
    id: "coincroc",
    name: "Coincroc",
    era: "ARCADE",
    rarity: "rare",
    assetBase: "/companions/coincroc",
  },
};

export const DEFAULT_COMPANION = "coincroc";

// ---- Evolution: stage from character level -------------------------------
export const STAGE_NAMES = ["hatchling", "juvenile", "adult"] as const;
/** Level at which each stage begins. */
export const STAGE_LEVELS = [1, 10, 25];

export function stageForLevel(level: number): number {
  if (level >= STAGE_LEVELS[2]) return 2;
  if (level >= STAGE_LEVELS[1]) return 1;
  return 0;
}

/** Levels remaining until the next evolution, or null if fully grown. */
export function levelsToNextStage(level: number): number | null {
  if (level < STAGE_LEVELS[1]) return STAGE_LEVELS[1] - level;
  if (level < STAGE_LEVELS[2]) return STAGE_LEVELS[2] - level;
  return null;
}

export function stageAsset(speciesId: string, stage: number): string {
  const sp = COMPANIONS[speciesId] ?? COMPANIONS[DEFAULT_COMPANION];
  const s = Math.max(0, Math.min(2, stage));
  return `${sp.assetBase}/${STAGE_NAMES[s]}.png`;
}

// ---- Mood: a gentle mirror of habits, never punishing --------------------
export type CompanionMood = "thriving" | "content" | "sleepy";

export function moodForStreak(currentStreak: number): CompanionMood {
  if (currentStreak >= 3) return "thriving";
  if (currentStreak <= 0) return "sleepy"; // napping, perks up on a streak
  return "content";
}

// ---- Colour fingerprint: a blend of where your XP goes -------------------
// Each domain has a hue; the card glow is a weighted blend, so it's a smooth
// palette (never binary) that shifts a little as habits shift.
const STAT_HUES: Record<string, [number, number, number]> = {
  CHORE: [34, 197, 94], // green
  EXERCISE: [249, 115, 22], // orange
  BIBLE: [234, 179, 8], // gold
  SCHOOL: [99, 102, 241], // indigo
  TASK: [20, 184, 166], // teal
};

const NEUTRAL = "#94a3b8";

export function blendPalette(xpByStat: Record<string, number>): string {
  const keys = Object.keys(STAT_HUES);
  const total = keys.reduce((n, k) => n + (xpByStat[k] || 0), 0);
  if (total <= 0) return NEUTRAL;
  let r = 0,
    g = 0,
    b = 0;
  for (const k of keys) {
    const w = (xpByStat[k] || 0) / total;
    const [hr, hg, hb] = STAT_HUES[k];
    r += hr * w;
    g += hg * w;
    b += hb * w;
  }
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

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

export type CompanionEra =
  | "MODERN"
  | "TOON"
  | "ARCADE"
  | "DRAGON"
  | "VINTAGE"
  | "WW2"
  | "IMAGINARY";

export type CompanionSpecies = {
  id: string;
  name: string;
  era: CompanionEra;
  rarity: "common" | "uncommon" | "rare" | "legendary";
  /** Public asset folder holding hatchling/juvenile/adult PNGs. */
  assetBase: string;
};

/** The roster. Add creatures here as the art arrives — it's just rows.
 *  (era/rarity are my best guesses — easy to retune.) */
export const COMPANIONS: Record<string, CompanionSpecies> = {
  // Modern · common
  sprout_pup: c("sprout_pup", "Sprout Pup", "MODERN", "common"),
  pebblet: c("pebblet", "Pebblet", "MODERN", "common"),
  fuzzle: c("fuzzle", "Fuzzle", "MODERN", "common"),
  blinky: c("blinky", "Blinky", "MODERN", "common"),
  hopscotch: c("hopscotch", "Hopscotch", "MODERN", "common"),
  dewdrop: c("dewdrop", "Dewdrop", "MODERN", "common"),
  mossback: c("mossback", "Mossback", "MODERN", "common"),
  puddin: c("puddin", "Puddin'", "MODERN", "common"),
  tumble: c("tumble", "Tumble", "MODERN", "common"),
  snugglet: c("snugglet", "Snugglet", "MODERN", "common"),
  waddles: c("waddles", "Waddles", "MODERN", "common"),
  // '80s / '90s Toon · uncommon
  emberkit: c("emberkit", "Emberkit", "TOON", "uncommon"),
  // Arcade · rare
  coincroc: c("coincroc", "Coincroc", "ARCADE", "rare"),
  bitwing: c("bitwing", "Bitwing", "ARCADE", "rare"),
  glitchkit: c("glitchkit", "Glitchkit", "ARCADE", "rare"),
  pixiepuff: c("pixiepuff", "Pixiepuff", "ARCADE", "rare"),
  bytehog: c("bytehog", "Bytehog", "ARCADE", "rare"),
  chompix: c("chompix", "Chompix", "ARCADE", "rare"),
  pixapup: c("pixapup", "Pixapup", "ARCADE", "rare"),
};

function c(
  id: string,
  name: string,
  era: CompanionEra,
  rarity: CompanionSpecies["rarity"],
): CompanionSpecies {
  return { id, name, era, rarity, assetBase: `/companions/${id}` };
}

/** Egg skins, mapped to the era or rarity pool they hatch from. Purely
 *  cosmetic variety — extra eggs per era are welcome. */
export type EggSkin = {
  id: string;
  asset: string;
  era?: CompanionEra;
  minRarity?: CompanionSpecies["rarity"];
};
export const EGGS: Record<string, EggSkin> = {
  modern: { id: "modern", asset: "/companions/eggs/modern.png", era: "MODERN" },
  arcade: { id: "arcade", asset: "/companions/eggs/arcade.png", era: "ARCADE" },
  toon: { id: "toon", asset: "/companions/eggs/toon.png", era: "TOON" },
  vintage: { id: "vintage", asset: "/companions/eggs/vintage.png", era: "VINTAGE" },
  military: { id: "military", asset: "/companions/eggs/military.png", era: "VINTAGE" },
  rare: { id: "rare", asset: "/companions/eggs/rare.png", minRarity: "rare" },
  mystery: { id: "mystery", asset: "/companions/eggs/mystery.png" },
};

/** Which species a new person starts with — picked deterministically from a
 *  stable hash of their id so, with a real roster, no two people share a
 *  starter by default (no more everyone-has-Coincroc). */
const STARTER_POOL = [
  "sprout_pup", "pixapup", "chompix", "bytehog", "pebblet", "hopscotch",
  "blinky", "fuzzle", "snugglet", "puddin", "dewdrop", "tumble", "pixiepuff",
  "coincroc", "emberkit", "waddles", "mossback",
];
export function starterCompanion(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return STARTER_POOL[h % STARTER_POOL.length] ?? DEFAULT_COMPANION;
}

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

// ---- Incubation & hatching -------------------------------------------------
// Everyone starts as an egg. The egg fills from lifetime XP; the first hatches
// quickly so nobody's pet-less long, then each takes ~1–2 weeks of steady work.
// A per-season cap keeps a 50+ roster a long haul. These are placeholders to be
// calibrated against the Season planner once all events are locked in.
export const FIRST_EGG_XP = 80;
export const EGG_XP = 250;
export const EGGS_PER_SEASON_CAP = 2;

/** XP needed for the Nth egg (0-indexed): the first is cheap. */
export function eggCostFor(eggsHatched: number): number {
  return eggsHatched === 0 ? FIRST_EGG_XP : EGG_XP;
}

// Active companion evolves on its OWN tenure (work done while it's your buddy),
// not your all-time level — so raising each one feels real.
export const TENURE_STAGE_XP = [0, 150, 500];
export function stageForTenure(tenureXp: number): number {
  if (tenureXp >= TENURE_STAGE_XP[2]) return 2;
  if (tenureXp >= TENURE_STAGE_XP[1]) return 1;
  return 0;
}

type Rarity = CompanionSpecies["rarity"];

/** Rarity odds shift with how high you climbed your season (tier 1–10). Higher
 *  tiers raise the shot at rare/legendary — same work, better pulls for going
 *  above and beyond. */
export function rarityWeights(tier: number): Record<Rarity, number> {
  const t = Math.max(0, Math.min(10, tier)) / 10; // 0..1
  return {
    common: 70 - 30 * t,
    uncommon: 22 + 6 * t,
    rare: 7 + 16 * t,
    legendary: 1 + 8 * t,
  };
}

/**
 * Draw a species the person does NOT already own (no duplicates, ever),
 * weighted by rarity for their tier. Falls back across rarities if a tier is
 * exhausted. Returns null only when the whole roster is collected.
 */
export function pickHatch(
  owned: string[],
  tier: number,
  rand: () => number = Math.random,
): string | null {
  const ownedSet = new Set(owned);
  const pool = Object.values(COMPANIONS).filter((s) => !ownedSet.has(s.id));
  if (pool.length === 0) return null;

  const weights = rarityWeights(tier);
  const order: Rarity[] = ["legendary", "rare", "uncommon", "common"];
  // Weighted pick of a rarity that still has unowned members.
  const available = order.filter((r) => pool.some((s) => s.rarity === r));
  const total = available.reduce((n, r) => n + weights[r], 0);
  let roll = rand() * total;
  let chosen: Rarity = available[available.length - 1];
  for (const r of available) {
    roll -= weights[r];
    if (roll <= 0) {
      chosen = r;
      break;
    }
  }
  const tierPool = pool.filter((s) => s.rarity === chosen);
  const bag = tierPool.length ? tierPool : pool;
  return bag[Math.floor(rand() * bag.length)]!.id;
}

/** The egg skin to show while incubating / at hatch, matched to a creature's
 *  era. */
export function eggSkinForEra(era: CompanionEra): string {
  const map: Record<CompanionEra, string> = {
    MODERN: "modern",
    TOON: "toon",
    ARCADE: "arcade",
    DRAGON: "rare",
    VINTAGE: "vintage",
    WW2: "military",
    IMAGINARY: "mystery",
  };
  return `/companions/eggs/${map[era] ?? "mystery"}.png`;
}

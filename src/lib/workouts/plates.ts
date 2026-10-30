// The plates the calculator can load, with real-world relative sizes so the
// barbell drawing is accurately scaled. Diameter and thickness are in
// millimetres (approximate real plates); the drawing scales mm → px.
//
// Color scheme (per lb):
//   bumpers  10=black, 25=green, 35=yellow, 45=blue, 55=red
//   fractional .25=green, .5=yellow, .75=blue, 1=red
//   steel/change plates (2.5, 5, 10) are grey
// Bumpers can be shown in their colors or all black (a per-user setting, later).

export type PlateKind = "bumper" | "steel" | "fraction";

export type Plate = {
  id: string;
  weight: number; // lb, per plate
  kind: PlateKind;
  color: string; // hex
  darkLabel: boolean; // true when the plate face is light (use dark text)
  diameterMm: number;
  thicknessMm: number;
};

export const PLATE_COLORS = {
  black: "#1f1f22",
  green: "#2f9e44",
  yellow: "#f2c037",
  blue: "#1c7ed6",
  red: "#e03131",
  grey: "#6b7280",
} as const;

// Full standard bar diameter (20kg/45lb bumper): 450mm. Bumpers share that
// diameter and differ in thickness by weight. Steel and fractional plates are
// smaller across.
export const BUMPERS: Plate[] = [
  { id: "b55", weight: 55, kind: "bumper", color: PLATE_COLORS.red, darkLabel: false, diameterMm: 450, thicknessMm: 95 },
  { id: "b45", weight: 45, kind: "bumper", color: PLATE_COLORS.blue, darkLabel: false, diameterMm: 450, thicknessMm: 78 },
  { id: "b35", weight: 35, kind: "bumper", color: PLATE_COLORS.yellow, darkLabel: true, diameterMm: 450, thicknessMm: 62 },
  { id: "b25", weight: 25, kind: "bumper", color: PLATE_COLORS.green, darkLabel: false, diameterMm: 450, thicknessMm: 48 },
  { id: "b10", weight: 10, kind: "bumper", color: PLATE_COLORS.black, darkLabel: false, diameterMm: 450, thicknessMm: 26 },
];

export const STEEL: Plate[] = [
  { id: "s10", weight: 10, kind: "steel", color: PLATE_COLORS.grey, darkLabel: false, diameterMm: 232, thicknessMm: 25 },
  { id: "s5", weight: 5, kind: "steel", color: PLATE_COLORS.grey, darkLabel: false, diameterMm: 205, thicknessMm: 20 },
  { id: "s2_5", weight: 2.5, kind: "steel", color: PLATE_COLORS.grey, darkLabel: false, diameterMm: 160, thicknessMm: 16 },
];

export const FRACTIONS: Plate[] = [
  { id: "f1", weight: 1, kind: "fraction", color: PLATE_COLORS.red, darkLabel: false, diameterMm: 135, thicknessMm: 13 },
  { id: "f075", weight: 0.75, kind: "fraction", color: PLATE_COLORS.blue, darkLabel: false, diameterMm: 125, thicknessMm: 12 },
  { id: "f05", weight: 0.5, kind: "fraction", color: PLATE_COLORS.yellow, darkLabel: true, diameterMm: 115, thicknessMm: 11 },
  { id: "f025", weight: 0.25, kind: "fraction", color: PLATE_COLORS.green, darkLabel: false, diameterMm: 105, thicknessMm: 10 },
];

export const ALL_PLATES: Plate[] = [...BUMPERS, ...STEEL, ...FRACTIONS];

export const PLATE_BY_ID: Record<string, Plate> = Object.fromEntries(
  ALL_PLATES.map((p) => [p.id, p]),
);

// Bar options. `type` drives the drawing: a straight shaft, or the bent shaft
// of an Olympic EZ-curl bar. Editable per user later.
export type BarType = "straight" | "ez";
export type BarOption = { weight: number; label: string; type: BarType };

export const BARS: BarOption[] = [
  { weight: 45, label: "45", type: "straight" },
  { weight: 15, label: "15", type: "straight" },
  { weight: 19, label: "EZ", type: "ez" },
];

/**
 * The plates that make `total` on a bar of `barWeight`, as plate ids, one id
 * per pair, heaviest first: 45/35/25/10 bumpers, then 5 and 2.5 steel, then
 * fractions. Whatever can't be made from these is left off, so the
 * calculator shows the nearest load below. Empty when the total is the bar or
 * less.
 */
export function platesFor(total: number, barWeight: number): string[] {
  let perSide = (total - barWeight) / 2;
  if (!(perSide > 0)) return [];
  const order = ["b45", "b35", "b25", "b10", "s5", "s2_5", "f1", "f075", "f05", "f025"];
  const out: string[] = [];
  for (const id of order) {
    const w = PLATE_BY_ID[id].weight;
    while (perSide >= w - 1e-9) {
      out.push(id);
      perSide -= w;
    }
  }
  return out;
}

export function fmtWeight(lb: number): string {
  return Number.isInteger(lb) ? String(lb) : String(Math.round(lb * 100) / 100);
}

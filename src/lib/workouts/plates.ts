// The plates the calculator can load, with real-world relative sizes so the
// barbell drawing is accurately scaled. Diameter and thickness are in
// millimetres (approximate real plates); the drawing scales mm → px.
//
// Colour scheme (per lb):
//   bumpers  10=black, 25=green, 35=yellow, 45=blue, 55=red
//   fractional .25=green, .5=yellow, .75=blue, 1=red
//   steel/change plates (2.5, 5, 10) are grey
// Bumpers can be shown in their colours or all black (a per-user setting, later).

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

// Bar options (lb). Editable per user later.
export const BARS = [45, 15] as const;

export function fmtWeight(lb: number): string {
  return Number.isInteger(lb) ? String(lb) : String(Math.round(lb * 100) / 100);
}

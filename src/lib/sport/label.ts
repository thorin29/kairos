/**
 * What to call a day's sport (v0.662; v0.745): the sport picked on the event's
 * type or calendar, else the one its title, type or calendar names, else just
 * "Sport". A subscribed feed's event title is usually a team or rink
 * ("Team A @ Team B"), so the title often names none. Pure.
 */
const OTHER_SPORTS: [RegExp, string][] = [
  [/soccer|futsal/i, "Soccer"],
  [/basketball|hoops/i, "Basketball"],
  [/baseball/i, "Baseball"],
  [/softball/i, "Softball"],
  [/lacrosse/i, "Lacrosse"],
  [/volleyball/i, "Volleyball"],
  [/pickleball/i, "Pickleball"],
  [/tennis/i, "Tennis"],
  [/rugby/i, "Rugby"],
  [/wrestling/i, "Wrestling"],
  [/\bfootball\b/i, "Football"],
];

/** The sports to pick from (Admin → Calendar), in menu order. */
export const SPORTS: readonly string[] = ["Hockey", ...OTHER_SPORTS.map(([, l]) => l)];

/** A picked sport, or null for anything not in SPORTS. */
export function cleanSport(v: unknown): string | null {
  return typeof v === "string" && SPORTS.includes(v) ? v : null;
}

/** The sport the names give ("Sport" when none names one). */
export function sportDayLabel(...names: (string | null | undefined)[]): string {
  const text = names.filter(Boolean).join(" ");
  if (/hockey|stick\s*(and|&|n)\s*puck|skate|drop[-\s]?in|\bice\b|scrimmage/i.test(text)) return "Hockey";
  for (const [re, label] of OTHER_SPORTS) if (re.test(text)) return label;
  return "Sport";
}

/** An event's sport: its type's pick, its calendar's, else its names. */
export function eventSport(e: {
  title?: string | null;
  eventType?: { name?: string | null; sport?: string | null } | null;
  externalCalendar?: { name?: string | null; sport?: string | null } | null;
}): string {
  return (
    cleanSport(e.eventType?.sport) ??
    cleanSport(e.externalCalendar?.sport) ??
    sportDayLabel(e.title, e.eventType?.name, e.externalCalendar?.name)
  );
}

export type SportKind = "GAME" | "PRACTICE" | "OTHER";

/**
 * Game, practice or other (v0.676) for the hockey-aware suggestions: the event
 * type's setting when it has one (Admin → Calendar), else the title — " @ " or
 * " vs " is a game; Practice, Stick & Puck or Skate is a practice.
 */
export function sportKindOf(title: string | null | undefined, override?: string | null): SportKind {
  if (override === "GAME" || override === "PRACTICE" || override === "OTHER") return override;
  const t = ` ${title ?? ""} `;
  if (/practice|stick\s*(and|&|n)\s*puck|skate/i.test(t)) return "PRACTICE";
  if (/ @ | vs\.? /i.test(t)) return "GAME";
  return "OTHER";
}

/** A tournament (v0.676): 3 or more games within 4 days. The days of it. */
export function tournamentDays(gameDays: readonly string[]): string[] {
  const days = [...new Set(gameDays)].sort();
  const plus = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const out = new Set<string>();
  for (const d of days) {
    const inside = days.filter((x) => x >= d && x <= plus(d, 3));
    if (inside.length >= 3) for (const x of inside) out.add(x);
  }
  return [...out].sort();
}

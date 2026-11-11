/**
 * What to call a day's sport (v0.662; v0.671): sport-flagged events here are
 * hockey unless the event's title, its event type or its calendar names
 * another sport. A subscribed feed's event title is usually a team or rink
 * ("Team A @ Team B"), so the title alone is never the label. Pure.
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

export function sportDayLabel(...names: (string | null | undefined)[]): string {
  const text = names.filter(Boolean).join(" ");
  if (/hockey|stick\s*(and|&|n)\s*puck|skate|drop[-\s]?in|\bice\b|scrimmage/i.test(text)) return "Hockey";
  for (const [re, label] of OTHER_SPORTS) if (re.test(text)) return label;
  return "Hockey";
}

/**
 * What to call a day's sport on the warm-up switch (v0.662): "Hockey" for
 * anything on the ice (a game, practice, stick and puck, a drop-in), else
 * the event's own title, short. Pure.
 */
export function sportDayLabel(title: string | null | undefined): string {
  const t = (title ?? "").trim();
  if (!t || /hockey|stick\s*(and|&|n)\s*puck|skate|drop[-\s]?in|\bice\b|scrimmage/i.test(t)) return "Hockey";
  return t.length > 16 ? `${t.slice(0, 15)}…` : t;
}

/**
 * A movement planned twice on one day (v0.736): Hollow hold in Core and again
 * in an Isometric workout. A day's sets, skips and "how did it feel" are kept
 * per movement, so the second card would show the first card's sets as its
 * own and finish itself. The first card in the day's order keeps the movement;
 * every later card drops it for the day.
 *
 * Pure, so the server (what completes the day, the phone's cards) and the web
 * day page decide it the same way.
 */
export function repeatsByPlan(
  plans: readonly { id: string; name: string; exercises: readonly { poolExerciseId: string }[] }[],
): Map<string, Map<string, string>> {
  const first = new Map<string, { planId: string; name: string }>();
  const out = new Map<string, Map<string, string>>();
  for (const p of plans) {
    for (const e of p.exercises) {
      const id = e.poolExerciseId;
      if (!id) continue;
      const owner = first.get(id);
      if (!owner) {
        first.set(id, { planId: p.id, name: p.name });
        continue;
      }
      // The same movement twice in one card is that card's own business.
      if (owner.planId === p.id) continue;
      const mine = out.get(p.id) ?? new Map<string, string>();
      mine.set(id, owner.name);
      out.set(p.id, mine);
    }
  }
  return out;
}


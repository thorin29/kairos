import type { CurrentExtras, CurrentSetup, ProgramChoice } from "@/lib/workouts/program-run";

/**
 * A person's own version of a program (v0.666): the setup it had when they
 * ended or switched it, kept so they can start from it again. Pure.
 */
export type ProgramVersion = {
  savedOn: string;
  setup: CurrentSetup;
  extras: CurrentExtras;
};

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d, i) => d === b[i]);

/**
 * Whether a setup is changed from the program's default: other days, another
 * movement in a slot, a slot left out, other sets on a companion lift, or an
 * added lift. Training maxes alone don't count (they always differ), and nor
 * do extras (they start from whatever plan the person had).
 */
export function setupDiffers(setup: CurrentSetup, choice: ProgramChoice): boolean {
  if (!sameDays(setup.days, choice.defaultDays)) return true;
  if (Object.keys(setup.schemes).length > 0) return true;
  if (setup.added.length > 0) return true;
  for (const [i, d] of choice.days.entries()) {
    for (const r of d.roles) {
      const k = `${i}:${r.key}`;
      const pick = setup.removed.includes(k) ? null : (setup.picks[k] ?? null);
      if (pick !== r.defaultId) return true;
    }
  }
  return false;
}

/**
 * A saved version made fit to start from today: a movement that's gone from a
 * slot goes back to the slot's default, an added lift that's gone is dropped,
 * and sets or slots the program no longer has are left out. Null when the
 * program's days have changed shape since.
 */
export function cleanVersion(
  version: ProgramVersion,
  choice: ProgramChoice,
  poolIds: ReadonlySet<string>,
): ProgramVersion | null {
  const s = version.setup;
  if (!Array.isArray(s?.days) || s.days.length !== choice.days.length) return null;
  const picks: Record<string, string | null> = {};
  const removed: string[] = [];
  const schemes: Record<string, string> = {};
  choice.days.forEach((d, i) =>
    d.roles.forEach((r) => {
      const k = `${i}:${r.key}`;
      if ((s.removed ?? []).includes(k)) {
        picks[k] = null;
        removed.push(k);
        return;
      }
      const id = s.picks?.[k] ?? null;
      const ok = !!id && (r.options.some((o) => o.id === id) || poolIds.has(id));
      picks[k] = ok ? id : r.defaultId;
      if (!picks[k]) removed.push(k);
      const scheme = s.schemes?.[k];
      if (ok && !r.main && typeof scheme === "string" && scheme) schemes[k] = scheme;
    }),
  );
  const added = (s.added ?? []).filter(
    (a) => Number.isInteger(a.day) && a.day >= 0 && a.day < choice.days.length && poolIds.has(a.poolExerciseId),
  );
  const maxes: Record<string, number> = {};
  for (const [id, w] of Object.entries(s.maxes ?? {})) if (typeof w === "number" && w > 0 && poolIds.has(id)) maxes[id] = w;
  return {
    savedOn: version.savedOn,
    setup: { key: choice.key, days: s.days, picks, removed, schemes, added, maxes },
    extras: version.extras,
  };
}

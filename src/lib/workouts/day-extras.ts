/**
 * Day extras (v0.667): mobility, stretching or an isometric workout added to
 * one day only from "+ Additional". On the day they show like plan entries,
 * under an id of their own ("extra_<id>"), and never hold up the day being
 * done. Pure.
 */
export type DayExtraKind = "mobility" | "stretching" | "iso";
export const DAY_EXTRA_KINDS: readonly DayExtraKind[] = ["mobility", "stretching", "iso"];
export const EXTRA_PREFIX = "extra_";
/** At most this many extras on one day. */
export const MAX_DAY_EXTRAS = 6;

export const isExtraId = (id: string | null | undefined): id is string => !!id && id.startsWith(EXTRA_PREFIX);
export const extraRowId = (id: string) => id.slice(EXTRA_PREFIX.length);
export const extraId = (rowId: string) => `${EXTRA_PREFIX}${rowId}`;
export const dayExtraKindOf = (v: unknown): DayExtraKind | null =>
  typeof v === "string" && (DAY_EXTRA_KINDS as readonly string[]).includes(v) ? (v as DayExtraKind) : null;

/** The plan category an extra shows under. */
export const extraCategory = (kind: DayExtraKind): "MOBILITY" | "STRETCHING" | "ISOMETRIC" =>
  kind === "mobility" ? "MOBILITY" : kind === "stretching" ? "STRETCHING" : "ISOMETRIC";

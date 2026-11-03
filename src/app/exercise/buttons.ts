/**
 * The workout pages' button styles in one place (v0.627), so every secondary
 * action looks the same: a solid accent button for the main action, and an
 * accent-outlined one (2 px) for the rest. The old hairline outline read as
 * disabled. Sizes are separate constants (not overridden at the call site,
 * where two height classes would fight); add only width or margin there.
 */
const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-40";
const OUTLINE = "border-2 border-accent bg-surface text-accent hover:bg-accent hover:text-on-accent";

/** The main action: filled accent. */
export const PRIMARY_BTN = `${BASE} h-10 px-5 text-sm bg-accent text-on-accent hover:brightness-110`;

/** Every other action: accent outline and text on the surface colour. */
export const SECONDARY_BTN = `${BASE} h-10 px-4 text-sm ${OUTLINE}`;
/** The same, small (Swap, a row's action). */
export const SECONDARY_SM = `${BASE} h-9 px-3 text-xs ${OUTLINE}`;
/** The same, large (a full-width action at the foot of a list). */
export const SECONDARY_LG = `${BASE} h-11 px-4 text-sm ${OUTLINE}`;

/** Delete and the like: the secondary shape in red. */
export const DANGER_BTN = `${BASE} h-10 px-4 text-sm border-2 border-red-300 bg-surface text-red-700 hover:bg-red-50`;

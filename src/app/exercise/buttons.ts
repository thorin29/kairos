/**
 * The workout pages' button styles in one place (v0.627), so every secondary
 * action looks the same: a solid accent button for the main action, and an
 * accent-outlined one (1 px; v0.628, 2 px read as too heavy) for the rest. The old hairline outline read as
 * disabled. Sizes are separate constants (not overridden at the call site,
 * where two height classes would fight); add only width or margin there.
 */
const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-40";
const OUTLINE = "border border-accent bg-surface text-accent hover:bg-accent hover:text-on-accent";

/** The main action: filled accent. */
export const PRIMARY_BTN = `${BASE} h-10 px-5 text-sm bg-accent text-on-accent hover:brightness-110`;

/** Every other action: accent outline and text on the surface colour. */
export const SECONDARY_BTN = `${BASE} h-10 px-4 text-sm ${OUTLINE}`;
/** The same, small (Swap, a row's action). */
export const SECONDARY_SM = `${BASE} h-9 px-3 text-xs ${OUTLINE}`;
/** The same, large (a full-width action at the foot of a list). */
export const SECONDARY_LG = `${BASE} h-11 px-4 text-sm ${OUTLINE}`;

/** Delete and the like: the secondary shape in red. */
export const DANGER_BTN = `${BASE} h-10 px-4 text-sm border border-red-300 bg-surface text-red-700 hover:bg-red-50`;

/** A page's section (v0.691): the white card the full pages share (Family
 *  WOD, Pause, Edit plan, HIIT / CrossFit), headed by `SECTION_LABEL`. */
export const SECTION_CARD = "space-y-4 rounded-xl border border-hairline bg-surface px-4 py-4";
export const SECTION_LABEL = "text-xs font-semibold uppercase tracking-widest text-muted";
/** A choice chip: filled when on. */
export const CHIP = (on: boolean) =>
  `inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
    on ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
  }`;

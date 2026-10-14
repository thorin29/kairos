/**
 * Which calendar events carry a free-text note, and how long it may be.
 *
 * One rule, read by the web form, both server actions, the device API and
 * (ported) the phone — so the field can never be offered somewhere the save
 * then throws it away.
 *
 * A note belongs to the two kinds you look something up on later: an "Event"
 * (APPOINTMENT) — flight numbers, confirmation codes, what to bring — and a
 * "Medical / Dental" (OTHER). A custom event type such as a hockey game is a
 * deliberate exception even though it stores as OTHER: it is its own category,
 * not a medical appointment, and the note was asked for on neither.
 */
export const NOTES_MAX = 500;

export function takesNotes(
  kind: string | null | undefined,
  eventTypeId: string | null | undefined,
): boolean {
  // Blank counts as no type, matching Kotlin's isNullOrBlank() on the phone —
  // the two copies of this rule have to agree exactly, or the app offers a
  // field whose contents the server then throws away.
  if (eventTypeId && eventTypeId.trim()) return false;
  return kind === "APPOINTMENT" || kind === "OTHER";
}

/** A submitted note, trimmed and capped — or null when this event can't hold
 *  one, which also clears a note left behind by an earlier type. */
export function cleanNotes(
  raw: string | null | undefined,
  kind: string | null | undefined,
  eventTypeId: string | null | undefined,
): string | null {
  if (!takesNotes(kind, eventTypeId)) return null;
  const text = (raw ?? "").trim().slice(0, NOTES_MAX);
  return text || null;
}

/**
 * Birthdays and anniversaries: the yearly, all-day occasions. One list, so
 * every place that treats them alike — the form forcing all-day + yearly, the
 * uniform color, who may delete or create one — gets a new occasion at once.
 */
export const OCCASION_KINDS = ["BIRTHDAY", "ANNIVERSARY"] as const;

export function isOccasion(kind: string | null | undefined): boolean {
  return kind === "BIRTHDAY" || kind === "ANNIVERSARY";
}

/**
 * A title that names one person's or couple's occasion ("Sam's Birthday",
 * "Mom & Dad Anniversary"). Those are one-offs, so they are kept out of the
 * remembered event-name list, which is for names that recur.
 */
export function isOccasionName(name: string): boolean {
  return /\b(birthday|b-?day|anniversary)\b/i.test(name);
}

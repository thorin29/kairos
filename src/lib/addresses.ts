/**
 * Normalization for the saved-address book. Household-sized lists let us match
 * more forgivingly than we could at scale: we lowercase, drop punctuation, fold
 * common street-type abbreviations, and collapse whitespace, so "1234 Main Rd"
 * and "1234 Main Road" compare equal. Used for duplicate detection and (later)
 * type-ahead ranking. Pure and side-effect free — safe on client or server.
 */

const STREET_WORDS: [RegExp, string][] = [
  [/\b(street|str)\b/g, "st"],
  [/\b(road)\b/g, "rd"],
  [/\b(avenue|av)\b/g, "ave"],
  [/\b(drive)\b/g, "dr"],
  [/\b(boulevard|blvd)\b/g, "blvd"],
  [/\b(lane)\b/g, "ln"],
  [/\b(court)\b/g, "ct"],
  [/\b(place)\b/g, "pl"],
  [/\b(terrace|ter)\b/g, "ter"],
  [/\b(highway|hwy)\b/g, "hwy"],
  [/\b(parkway|pkwy)\b/g, "pkwy"],
  [/\b(north|n)\b/g, "n"],
  [/\b(south|s)\b/g, "s"],
  [/\b(east|e)\b/g, "e"],
  [/\b(west|w)\b/g, "w"],
];

/** Loose key for an address: case/punctuation/abbreviation-insensitive. */
export function normalizeAddress(input: string): string {
  let s = input.toLowerCase().replace(/[.,#]/g, " ");
  for (const [re, to] of STREET_WORDS) s = s.replace(re, to);
  return s.replace(/\s+/g, " ").trim();
}

/** Loose key for a friendly name: case and whitespace insensitive. */
export function normalizeName(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

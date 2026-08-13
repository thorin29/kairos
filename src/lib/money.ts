/**
 * Money constants, labels, and formatting.
 *
 * Dependency-free so both the browser (the add overlay, the table) and the
 * server (actions, queries) can import it — importing Prisma here would drag
 * the Postgres driver into the client bundle, the way `days.ts` and
 * `bible/books.ts` stay clean for the same reason. The string unions below
 * mirror the Prisma enums exactly; lookups take a plain `string` and fall
 * back, so a Prisma enum value can be passed straight in without the
 * `Record<Enum, …>`-indexed-by-string build trap.
 */

// The fixed deposit category pool, in display order. Payments carry none.
export const DEPOSIT_CATEGORIES = [
  "BIRTHDAY",
  "GIFT",
  "HOLIDAY",
  "EARNINGS",
  "BIBLE",
  "OTHER",
] as const;
export type DepositCategory = (typeof DEPOSIT_CATEGORIES)[number];

const CATEGORY_LABEL: Record<DepositCategory, string> = {
  BIRTHDAY: "Birthday",
  GIFT: "Gift",
  HOLIDAY: "Holiday",
  EARNINGS: "Earnings",
  BIBLE: "Bible reading",
  OTHER: "Other",
};

export function categoryLabel(c: string | null | undefined): string {
  if (!c) return "";
  return CATEGORY_LABEL[c as DepositCategory] ?? c;
}

// The label a table row shows in its description column, given its shape.
// Starting funds and (later) the Bible rewards read from their kind; ordinary
// deposits read from their category; payments and detail-only rows read their
// free text.
export function rowLabel(row: {
  kind: string;
  direction: string;
  category: string | null;
  detail: string | null;
}): string {
  if (row.kind === "STARTING") return "Starting funds";
  if (row.kind === "BIBLE_REWARD") return "Bible reading reward";
  if (row.kind === "BIBLE_BONUS") return "Bible reading bonus";
  if (row.direction === "DEPOSIT") {
    const cat = categoryLabel(row.category);
    if (cat && row.detail) return `${cat} — ${row.detail}`;
    return cat || row.detail || "Deposit";
  }
  // Payment: the free text is the whole description.
  return row.detail || "Payment";
}

/** The signed value of a row in cents: deposits add, payments subtract. */
export function signedCents(row: {
  direction: string;
  amountCents: number;
}): number {
  return row.direction === "DEPOSIT" ? row.amountCents : -row.amountCents;
}

/** Bare magnitude, two decimals, no sign and no symbol — for table cells. */
export function formatCents(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2);
}

/** A balance with a dollar sign, for the total beside a name. */
export function formatDollars(cents: number): string {
  const sign = cents < 0 ? "-$" : "$";
  return sign + (Math.abs(cents) / 100).toFixed(2);
}

/**
 * Best-guess a deposit category from free text (an Actual payee or note) so an
 * import lands rows in the right bucket where it can. Anything with no clear
 * match becomes OTHER, and the original text is kept as the row's detail — the
 * admin can always change the category in the review grid.
 */
export function guessCategory(text: string | null | undefined): DepositCategory {
  const t = (text ?? "").toLowerCase();
  if (/\bbirthday\b|\bb-?day\b/.test(t)) return "BIRTHDAY";
  if (/\bgift\b|\bpresent\b/.test(t)) return "GIFT";
  if (/\bholiday\b|christmas|xmas|easter|hanukkah|thanksgiving/.test(t))
    return "HOLIDAY";
  if (/\bearn|\bjob\b|\bchore|\bwork\b|allowance|wage|paid\b|pay\b/.test(t))
    return "EARNINGS";
  if (/\bbible\b|reading|scripture|memoriz/.test(t)) return "BIBLE";
  return "OTHER";
}

/**
 * A typed dollars-and-cents string to whole cents. Tolerates a leading "$",
 * thousands commas, and surrounding space. Returns null for anything that
 * isn't a clean money value, so a bad amount is caught rather than rounded
 * into nonsense.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  if (!/^-?\d*(\.\d{1,2})?$/.test(cleaned)) return null;
  const val = Math.round(parseFloat(cleaned) * 100);
  if (!Number.isFinite(val)) return null;
  return val;
}

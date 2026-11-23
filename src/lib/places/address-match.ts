/**
 * Whether two street addresses are the same place, ignoring how they're
 * written: "100 Example Pkwy, Springfield, TX 75000" (a saved address) and
 * "100 Example Parkway, Springfield, TX 75000, USA" (Google). Compares the
 * house number and street only, without suite or unit.
 */

const WORDS: Record<string, string> = {
  street: "st",
  avenue: "ave",
  parkway: "pkwy",
  boulevard: "blvd",
  drive: "dr",
  road: "rd",
  lane: "ln",
  court: "ct",
  circle: "cir",
  highway: "hwy",
  freeway: "fwy",
  place: "pl",
  terrace: "ter",
  trail: "trl",
  expressway: "expy",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
};

export function streetKey(address: string): string | null {
  const first = address.split(",")[0]?.toLowerCase() ?? "";
  const cut = first.replace(/\s(#|ste\.?|suite|unit|apt\.?|bldg\.?|building)\s*\S+.*$/, "");
  const words = cut
    .replace(/[.]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w);
  if (words.length < 2 || !/^\d/.test(words[0])) return null;
  return words.join(" ");
}

export function sameStreetAddress(a: string, b: string): boolean {
  const x = streetKey(a);
  return x != null && x === streetKey(b);
}

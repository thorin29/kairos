/**
 * The Hockey page's one rule for turning an ice-time feed into what is shown:
 * which days, which columns, what each "Add" button fills in. Both the web
 * page and `/api/v1/hockey` (the phone) use this, so the two never disagree
 * about an event's name or which sessions get a button.
 *
 * Pure — no database, no fetch — so it can be tested directly. The feed comes
 * from another container and is treated as untrusted: every field is checked.
 * Kairos knows nothing about any particular rink; names come from the feed.
 */

export type HockeyCount = { enrolled: number; max: number | null; remaining: number | null };

export type HockeyRow = {
  /** Local day, YYYY-MM-DD. */
  date: string;
  /** Local wall-clock times, HH:MM. */
  start: string;
  end: string;
  /** Days the end is after the start (an overnight session). */
  endDayOffset: number;
  minutes: number;
  rink: string | null;
  skaters: HockeyCount | null;
  goalies: HockeyCount | null;
  players: HockeyCount | null;
  /** Where to sign up for this session (the goalie page when there is one). */
  link: string | null;
  add: { title: string; label: string; location: string | null };
};

export type HockeySection = {
  name: string;
  /** Column headings: "Skaters"/"Goalies", or "Signed up" alone. */
  colA: string;
  colB: string | null;
  rows: HockeyRow[];
  /** One sign-up page for the section header link. */
  link: string | null;
  rink: string | null;
};

export type HockeyView = {
  /** The days shown, today first. */
  days: string[];
  sections: HockeySection[];
  rinks: string[];
  generatedAt: string | null;
  /** When the oldest of ice-time's schedules was last read (how fresh the
   *  counts are), or null before its first read. */
  checkedAt: string | null;
  warnings: string[];
};

export type SavedPlace = { name: string; address: string };

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function count(v: unknown): HockeyCount | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.round(x)) : null);
  const enrolled = n(o.enrolled);
  if (enrolled == null) return null;
  return { enrolled, max: n(o.max), remaining: n(o.remaining) };
}

function link(v: unknown): string | null {
  const s = str(v, 500);
  return s && /^https:\/\//i.test(s) ? s : null;
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A saved address for a rink: same name, or one name containing the other
 *  ("Rink" ↔ "Rink Ice Center"). Exact matches win. */
export function placeForRink(rink: string | null, places: SavedPlace[]): string | null {
  if (!rink) return null;
  const r = loose(rink);
  if (r.length < 3) return null;
  const exact = places.find((p) => loose(p.name) === r);
  if (exact) return exact.address;
  const partial = places.find((p) => {
    const n = loose(p.name);
    return n.length >= 3 && (n.includes(r) || r.includes(n));
  });
  return partial?.address ?? null;
}

/** "Drop-in: Rink", or just the section when the rink isn't named. */
export function eventTitle(section: string, rink: string | null): string {
  return rink ? `${section}: ${rink}` : section;
}

export function buildHockeyView(
  feed: unknown,
  opts: { today: string; days?: number; places: SavedPlace[] },
): HockeyView {
  const nDays = opts.days ?? 7;
  const days = Array.from({ length: nDays }, (_, i) => addDays(opts.today, i));
  const last = days[days.length - 1];
  const f = (feed && typeof feed === "object" ? feed : {}) as Record<string, unknown>;
  const rawSections = Array.isArray(f.sections) ? f.sections : [];
  const rinks = new Set<string>();
  const sections: HockeySection[] = [];

  for (const rs of rawSections.slice(0, 20)) {
    if (!rs || typeof rs !== "object") continue;
    const name = str((rs as Record<string, unknown>).name, 60);
    const rawRows = (rs as Record<string, unknown>).sessions;
    if (!name || !Array.isArray(rawRows)) continue;
    const rows: HockeyRow[] = [];
    for (const r of rawRows.slice(0, 500)) {
      if (!r || typeof r !== "object") continue;
      const o = r as Record<string, unknown>;
      const s = typeof o.start === "string" ? DATE_TIME.exec(o.start) : null;
      const e = typeof o.end === "string" ? DATE_TIME.exec(o.end) : null;
      if (!s || !e) continue;
      const date = s[1];
      if (date < opts.today || date > last) continue;
      const rink = str(o.rink, 80);
      if (rink) rinks.add(rink);
      const skaters = count(o.skaters);
      const goalies = count(o.goalies);
      const players = count(o.players);
      const links = (o.links && typeof o.links === "object" ? o.links : {}) as Record<string, unknown>;
      const signUp = link(links.goalies) ?? link(links.skaters) ?? link(links.players);
      const minutes =
        typeof o.minutes === "number" && o.minutes > 0
          ? Math.round(o.minutes)
          : Math.max(0, (Date.parse(`${o.end}Z`) - Date.parse(`${o.start}Z`)) / 60_000);
      rows.push({
        date,
        start: `${s[2]}:${s[3]}`,
        end: `${e[2]}:${e[3]}`,
        endDayOffset: Math.max(0, dayDiff(date, e[1])),
        minutes,
        rink,
        skaters,
        goalies,
        players,
        link: signUp,
        add: {
          title: eventTitle(name, rink),
          // Sessions with a goalie list are booked as the goalie session.
          label: goalies ? "Add goalie session" : "Add to calendar",
          location: placeForRink(rink, opts.places),
        },
      });
    }
    if (!rows.length) {
      // Keep the section so the web page can show its empty week.
      sections.push({ name, colA: "Signed up", colB: null, rows, link: null, rink: null });
      continue;
    }
    rows.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const split = rows.some((x) => x.skaters || x.goalies);
    const sectionRinks = [...new Set(rows.map((x) => x.rink).filter(Boolean))] as string[];
    sections.push({
      name,
      colA: split ? "Skaters" : "Signed up",
      colB: rows.some((x) => x.goalies) ? "Goalies" : null,
      rows,
      link: rows.find((x) => x.link)?.link ?? null,
      rink: sectionRinks.length === 1 ? sectionRinks[0] : null,
    });
  }

  const warnings = Array.isArray(f.warnings)
    ? (f.warnings.map((w) => str(w, 300)).filter(Boolean) as string[]).slice(0, 10)
    : [];

  const checks = (Array.isArray(f.sources) ? f.sources : [])
    .filter((x) => x && typeof x === "object" && (x as Record<string, unknown>).enabled !== false)
    .map((x) => str((x as Record<string, unknown>).lastSuccess, 40))
    .filter((x): x is string => Boolean(x) && !Number.isNaN(Date.parse(x as string)))
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  return {
    days,
    sections,
    rinks: [...rinks].sort(),
    generatedAt: str(f.generatedAt, 40),
    checkedAt: checks[0] ?? null,
    warnings,
  };
}

/** "x/y" for a count; "x" when there's no cap. */
export function countText(c: HockeyCount | null): string {
  if (!c) return "";
  return c.max != null ? `${c.enrolled}/${c.max}` : String(c.enrolled);
}

/** Open spots left, from the count. */
export function spotsLeft(c: HockeyCount): number {
  if (c.remaining != null) return c.remaining;
  return c.max != null ? Math.max(0, c.max - c.enrolled) : 1;
}

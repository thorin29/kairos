/**
 * Changing a plan's days, the pure part: adding readings (push the plan back,
 * add to existing days, or some of each), and reading or writing a plan as text
 * for import and export. Shared by the web forms (for the live preview), the
 * server actions and the mobile API, so the rules live in one place.
 *
 * No server imports, so client components can use it.
 */
import { addDays, dayOfWeek, daysBetween } from "@/lib/dates";
import { parsePassage } from "@/lib/bible/books";

/** A plan day. `isExtra`: the whole day is an extra reading; `extra`: a reading
 *  added on top of the day's plan reading. Extras count on the tracker, never
 *  toward the plan. */
export type PlanDay = { iso: string; passage: string; isExtra?: boolean; extra?: string | null };

/** A day's reading as shown: the plan reading, then any extra. */
export function dayLabel(passage: string, extra: string | null | undefined): string {
  if (!extra) return passage;
  return passage ? `${passage} + ${extra}` : extra;
}

export type AddMode = "push" | "add" | "mix";

export type EditedDay = PlanDay & {
  /** "new": a reading on its own day; "added": stacked onto an existing day;
   *  "moved": an existing reading that moved later. */
  tag: "" | "new" | "added" | "moved";
  fromISO?: string;
};

export type AddResult = {
  error: string | null;
  days: EditedDay[];
  oldEndISO: string | null;
  endISO: string | null;
};

const MAX_PASSAGE = 200;
const MAX_READINGS = 400;

/** The weekdays a plan reads on, from its days. A plan shorter than two weeks
 *  says nothing about its weekdays, so it reads every day. */
function readingWeekdays(days: PlanDay[]): Set<number> {
  const all = new Set([0, 1, 2, 3, 4, 5, 6]);
  if (days.length === 0 || daysBetween(days[0].iso, days[days.length - 1].iso) < 13) return all;
  return new Set(days.map((d) => dayOfWeek(d.iso)));
}

function nextReadingDay(iso: string, weekdays: Set<number>): string {
  let d = addDays(iso, 1);
  for (let i = 0; i < 7 && !weekdays.has(dayOfWeek(d)); i++) d = addDays(d, 1);
  return d;
}

/**
 * Places `readings` (one per day, in order) into a plan from `startISO`, as
 * extras: a reading on its own day is an extra day, one on top of a day is
 * that day's extra.
 *
 * - push: each reading gets its own day; everything from the start date moves
 *   later by that many reading days.
 * - add: readings go on top of the plan's days from the start date.
 * - mix: the first `ownDays` readings get their own days (the end moves that
 *   many reading days), the rest go on top of the days after them.
 *
 * Reading days follow the plan's own weekdays, so a weekday-only plan stays
 * weekday-only.
 */
export function addReadings(
  days: PlanDay[],
  readings: string[],
  startISO: string,
  mode: AddMode,
  ownDays = 0,
): AddResult {
  const sorted = [...days].sort((a, b) => a.iso.localeCompare(b.iso));
  const oldEndISO = sorted.length ? sorted[sorted.length - 1].iso : null;
  const list = readings.map((r) => r.trim()).filter(Boolean);

  if (list.length === 0) return { error: "Add a reading first.", days: [], oldEndISO, endISO: oldEndISO };
  if (list.length > MAX_READINGS) return { error: "That's too many readings at once.", days: [], oldEndISO, endISO: oldEndISO };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO)) return { error: "Pick a start date.", days: [], oldEndISO, endISO: oldEndISO };

  const n = list.length;
  const own = mode === "push" ? n : mode === "add" ? 0 : Math.max(0, Math.min(n, Math.round(ownDays)));
  const weekdays = readingWeekdays(sorted);

  const before = sorted.filter((d) => d.iso < startISO);
  const after = sorted.filter((d) => d.iso >= startISO);

  // Reading days from the start date. The start date itself is always one,
  // even when the plan has no reading on it.
  const gap = after.length === 0 || after[0].iso !== startISO ? 1 : 0;
  const slots: string[] = gap ? [startISO, ...after.map((d) => d.iso)] : after.map((d) => d.iso);
  const shift = Math.max(0, own - gap);
  const need = Math.max(after.length + gap + shift, n);
  while (slots.length < need) slots.push(nextReadingDay(slots[slots.length - 1], weekdays));

  const placed: (EditedDay | null)[] = slots.map(() => null);

  for (let i = 0; i < own; i++) {
    placed[i] = { iso: slots[i], passage: list[i], isExtra: true, tag: "new" };
  }
  after.forEach((d, j) => {
    const idx = j + gap + shift;
    const iso = slots[idx];
    placed[idx] = {
      iso,
      passage: d.passage,
      isExtra: d.isExtra,
      extra: d.extra ?? null,
      tag: iso === d.iso ? "" : "moved",
      fromISO: iso === d.iso ? undefined : d.iso,
    };
  });
  for (let i = own; i < n; i++) {
    const cur = placed[i];
    placed[i] = cur
      ? { ...cur, extra: (cur.extra ? `${cur.extra}; ${list[i]}` : list[i]).slice(0, MAX_PASSAGE), tag: "added" }
      : { iso: slots[i], passage: list[i], isExtra: true, tag: "new" };
  }

  const out: EditedDay[] = [
    ...before.map((d) => ({ ...d, tag: "" as const })),
    ...placed.filter((d): d is EditedDay => d !== null),
  ].map((d) => ({ ...d, passage: d.passage.slice(0, MAX_PASSAGE) }));

  return { error: null, days: out, oldEndISO, endISO: out.length ? out[out.length - 1].iso : null };
}

/** Readings as one label per day: consecutive chapters of a book join up
 *  ("Luke 2-3"), anything else is separated with "; ". */
export function joinChapters(refs: { book: string; chapter: number }[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < refs.length) {
    const { book, chapter } = refs[i];
    let end = chapter;
    while (i + 1 < refs.length && refs[i + 1].book === book && refs[i + 1].chapter === end + 1) {
      end++;
      i++;
    }
    parts.push(end === chapter ? `${book} ${chapter}` : `${book} ${chapter}-${end}`);
    i++;
  }
  return parts.join("; ");
}

// ---------------------------------------------------------------
// Import and export
// ---------------------------------------------------------------

export type ParsedPlan = {
  error: string | null;
  name: string | null;
  dated: boolean;
  days: PlanDay[];
  skipped: string[];
};

export function normalizeDate(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

/** "Rev 16-17 + Luke 2" → plan reading and extra; "+ Luke 2" → an extra day. */
function splitExtra(text: string): { passage: string; extra: string | null } {
  const i = text.indexOf("+");
  if (i < 0) return { passage: text.trim(), extra: null };
  return { passage: text.slice(0, i).trim(), extra: text.slice(i + 1).trim() || null };
}

function readable(text: string): boolean {
  const { passage, extra } = splitExtra(text);
  if (!passage && !extra) return false;
  return (!passage || parsePassage(passage).length > 0) && (!extra || parsePassage(extra).length > 0);
}

function splitDated(line: string): { iso: string; passage: string } | null {
  const sep = line.includes("\t") ? line.indexOf("\t") : line.indexOf(",");
  if (sep < 0) return null;
  const iso = normalizeDate(line.slice(0, sep).trim().replace(/^["']|["']$/g, ""));
  if (!iso) return null;
  return { iso, passage: line.slice(sep + 1).trim().replace(/^["']|["']$/g, "") };
}

/**
 * Reads a plan from text. Dated: one day per line, date then passage (comma or
 * tab; 2026-12-01 or 12/1/2026). Undated: passages only, one day per line,
 * laid out from `startISO` on the given weekdays. A "#" line names the plan.
 * Lines that can't be read come back in `skipped` rather than vanishing.
 */
export function parsePlanText(
  text: string,
  opts: { startISO?: string; weekdays?: number[] } = {},
): ParsedPlan {
  let name: string | null = null;
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      if (name === null) name = line.replace(/^#+/, "").trim().slice(0, 80) || null;
      continue;
    }
    if (/^date\s*[,\t]/i.test(line)) continue;
    lines.push(line);
  }

  const dated = lines.some((l) => splitDated(l) !== null);
  const skipped: string[] = [];
  const byDay = new Map<string, string>();
  const join = (a: string | undefined, b: string) => {
    if (!a) return b;
    const x = splitExtra(a);
    const y = splitExtra(b);
    const passage = [x.passage, y.passage].filter(Boolean).join("; ");
    const extra = [x.extra, y.extra].filter(Boolean).join("; ");
    return extra ? `${passage} + ${extra}` : passage;
  };

  if (dated) {
    for (const line of lines) {
      const row = splitDated(line);
      if (!row || !readable(row.passage)) {
        skipped.push(line.slice(0, 60));
        continue;
      }
      byDay.set(row.iso, join(byDay.get(row.iso), row.passage));
    }
  } else {
    const start = opts.startISO ?? "";
    const weekdays = new Set((opts.weekdays ?? []).filter((d) => d >= 0 && d <= 6));
    if (lines.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return { error: "Pick a start date.", name, dated, days: [], skipped };
    }
    if (lines.length > 0 && weekdays.size === 0) {
      return { error: "Pick the days to read.", name, dated, days: [], skipped };
    }
    let iso = start;
    for (let i = 0; i < 7 && !weekdays.has(dayOfWeek(iso)); i++) iso = addDays(iso, 1);
    for (const line of lines) {
      if (!readable(line)) {
        skipped.push(line.slice(0, 60));
        continue;
      }
      byDay.set(iso, line);
      iso = nextReadingDay(iso, weekdays);
    }
  }

  const days: PlanDay[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, text]) => {
      const { passage, extra } = splitExtra(text);
      if (!passage) return { iso, passage: (extra ?? "").slice(0, MAX_PASSAGE), isExtra: true };
      return extra
        ? { iso, passage: passage.slice(0, MAX_PASSAGE), extra: extra.slice(0, MAX_PASSAGE) }
        : { iso, passage: passage.slice(0, MAX_PASSAGE) };
    });

  if (days.length === 0) {
    return { error: "Nothing readable in that.", name, dated, days, skipped };
  }
  if (days.length > 1500) {
    return { error: "That plan is far too long.", name, dated, days: [], skipped };
  }
  return { error: null, name, dated, days, skipped: skipped.slice(0, 20) };
}

/** A plan as text, in the same dated format import reads. Extras follow a "+":
 *  "2026-12-23, Revelation 16-17 + Luke 2", or "2026-12-24, + Isaiah 9" for an
 *  extra day. */
export function formatPlanText(name: string, days: PlanDay[]): string {
  const rows = [...days]
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map((d) => {
      if (d.isExtra) return `${d.iso}, + ${[d.passage, d.extra].filter(Boolean).join("; ")}`;
      return d.extra ? `${d.iso}, ${d.passage} + ${d.extra}` : `${d.iso}, ${d.passage}`;
    });
  return [`# ${name}`, ...rows].join("\n") + "\n";
}

/** A file-safe name for an exported plan. */
export function exportFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "reading-plan"}.txt`;
}

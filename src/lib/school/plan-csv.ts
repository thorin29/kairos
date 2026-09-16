// Parse an uploaded curriculum CSV into class-plan inputs. Two grains, chosen by
// which columns are present:
//   SHORTHAND (one row per class):  ...,unitNoun,unitCount,unitSize,testsAfterLesson
//   EXPANDED  (one row per unit):   ...,seq,label,type,load   (grouped by student+class)
// Class-level columns (student,class,subject,term,perDay,weekdays,startFrom) may
// repeat on every expanded row; the first non-empty value wins. testsAfterLesson
// is semicolon-separated (CSV commas are taken). Nothing here talks to an AI or
// reads a PDF — it only parses clean input the user (or a Claude chat) produced.

import { expandShorthand, type PlanUnit, type PlanUnitType } from "./plan-builder";

export type ClassPlanInput = {
  student: string;
  className: string;
  subject: string;
  term: "fall" | "spring" | "both";
  perDay: number;
  weekdays: number[];
  /** First unit to schedule, e.g. "L9" or a 1-based seq; "" = from the start. */
  startFrom: string;
  units: PlanUnit[];
};

/** Split one CSV line into fields, honoring double-quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function num(v: string | undefined, dflt: number): number {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) ? n : dflt;
}
function weekdaysOf(v: string | undefined): number[] {
  const s = (v ?? "12345").replace(/[^1-7]/g, "");
  return (s || "12345").split("").map(Number);
}
function termOf(v: string | undefined): "fall" | "spring" | "both" {
  const t = (v ?? "").trim().toLowerCase();
  return t === "spring" ? "spring" : t === "fall" ? "fall" : "both";
}
function typeOf(v: string | undefined): PlanUnitType {
  const t = (v ?? "").trim().toLowerCase();
  if (t === "test") return "TEST";
  if (t === "project") return "PROJECT";
  return "ASSIGNMENT"; // lesson / assignment / blank
}

export function parseClassPlanCsv(text: string): { plans: ClassPlanInput[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { plans: [], errors: ["CSV has no data rows."] };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (row: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? row[i] : undefined;
  };
  const expanded = header.includes("seq") || header.includes("label");

  if (expanded) {
    // group rows by student + class, ordered by seq
    const groups = new Map<string, { first: string[]; rows: string[][] }>();
    for (const line of lines.slice(1)) {
      const row = splitCsvLine(line);
      const key = `${col(row, "student")}||${col(row, "class")}`;
      if (!groups.has(key)) groups.set(key, { first: row, rows: [] });
      groups.get(key)!.rows.push(row);
    }
    const plans: ClassPlanInput[] = [];
    for (const { first, rows } of groups.values()) {
      rows.sort((a, b) => num(col(a, "seq"), 0) - num(col(b, "seq"), 0));
      const units: PlanUnit[] = rows.map((r) => ({
        label: (col(r, "label") ?? "").trim(),
        type: typeOf(col(r, "type")),
        load: num(col(r, "load"), 1),
      }));
      plans.push({
        student: (col(first, "student") ?? "").trim(),
        className: (col(first, "class") ?? "").trim(),
        subject: (col(first, "subject") ?? "").trim(),
        term: termOf(col(first, "term")),
        perDay: num(col(first, "perday"), 1),
        weekdays: weekdaysOf(col(first, "weekdays")),
        startFrom: (col(first, "startfrom") ?? "").trim(),
        units,
      });
    }
    return { plans, errors };
  }

  // shorthand: one row per class
  const plans: ClassPlanInput[] = [];
  for (const line of lines.slice(1)) {
    const row = splitCsvLine(line);
    const unitCount = num(col(row, "unitcount"), 0);
    if (unitCount <= 0) {
      errors.push(`Skipped a row with no unitCount: ${line.slice(0, 40)}`);
      continue;
    }
    const testsRaw = (col(row, "testsafterlesson") ?? "").trim();
    const testsAfterLesson = testsRaw
      ? testsRaw.split(/[;,]/).map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    plans.push({
      student: (col(row, "student") ?? "").trim(),
      className: (col(row, "class") ?? "").trim(),
      subject: (col(row, "subject") ?? "").trim(),
      term: termOf(col(row, "term")),
      perDay: num(col(row, "perday"), 1),
      weekdays: weekdaysOf(col(row, "weekdays")),
      startFrom: (col(row, "startfrom") ?? "").trim(),
      units: expandShorthand({
        unitCount,
        unitNoun: (col(row, "unitnoun") ?? "Lesson").trim() || "Lesson",
        unitSize: num(col(row, "unitsize"), 1),
        testsAfterLesson,
      }),
    });
  }
  return { plans, errors };
}

/** Resolve startFrom ("L9", a seq number, or "") to a 0-based unit index. */
export function startIndexOf(units: PlanUnit[], startFrom: string): number {
  const s = (startFrom || "").trim();
  if (!s) return 0;
  const mNum = s.match(/^\d+$/);
  if (mNum) return Math.min(Math.max(0, Number(s) - 1), units.length);
  // "L9" / "Lesson 9" -> first unit whose label ends in that number
  const mL = s.match(/(\d+)\s*$/);
  if (mL) {
    const n = mL[1];
    const idx = units.findIndex((u) => new RegExp(`\\b${n}$`).test(u.label));
    if (idx >= 0) return idx;
  }
  const exact = units.findIndex((u) => u.label.toLowerCase() === s.toLowerCase());
  return exact >= 0 ? exact : 0;
}

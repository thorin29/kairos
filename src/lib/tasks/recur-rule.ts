import { addDays, dayOfWeek, daysBetween } from "@/lib/dates";

/**
 * When a repeating task lands (pure). Every `interval` days, weeks, months or
 * years from its first due date (v0.668 adds years and lifts the old cap of
 * 52). Weekly lands on the chosen weekdays, or the first due date's weekday.
 * Monthly on a day the month doesn't have (the 31st) lands on its last day;
 * yearly on Feb 29 lands on Feb 28 in other years.
 */
export const TASK_FREQS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type TaskFreq = (typeof TASK_FREQS)[number];
export const MAX_TASK_INTERVAL = 999;
const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export type RecurRule = {
  freq: string;
  interval: number;
  /** Weekly: comma-separated day codes, or empty for the start's weekday. */
  byday: string | null;
  startISO: string;
};

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Whether the rule lands on `iso` (ignoring any end). */
export function occursOn(r: RecurRule, iso: string): boolean {
  const startISO = r.startISO;
  if (iso < startISO) return false;
  const interval = Math.max(1, r.interval || 1);

  if (r.freq === "DAILY") return daysBetween(startISO, iso) % interval === 0;

  if (r.freq === "WEEKLY") {
    const codes = (r.byday || "")
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length > 0) {
      if (!codes.includes(DOW[dayOfWeek(iso)])) return false;
    } else if (dayOfWeek(iso) !== dayOfWeek(startISO)) {
      return false;
    }
    if (interval === 1) return true;
    // Every N-th week, aligned to the start's week (Sunday-based).
    const startWeek = addDays(startISO, -dayOfWeek(startISO));
    const thisWeek = addDays(iso, -dayOfWeek(iso));
    return Math.floor(daysBetween(startWeek, thisWeek) / 7) % interval === 0;
  }

  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [y, m, d] = iso.split("-").map(Number);

  if (r.freq === "MONTHLY") {
    if (d !== Math.min(sd, daysInMonth(y, m))) return false;
    const months = (y - sy) * 12 + (m - sm);
    return months >= 0 && months % interval === 0;
  }

  if (r.freq === "YEARLY") {
    if (m !== sm || d !== Math.min(sd, daysInMonth(y, m))) return false;
    return (y - sy) % interval === 0;
  }

  return false;
}

const DAY_SHORT: Record<string, string> = { SU: "Sun", MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
};

/** A short line for a repeating task: "Every 90 days", "Weekly on Wed",
 *  "Every 2 weeks on Mon, Thu", "Monthly on the 30th", "Yearly on Jan 30". */
export function recurLabel(r: RecurRule): string {
  const n = Math.max(1, r.interval || 1);
  const [, sm, sd] = (r.startISO || "2000-01-01").split("-").map(Number);
  if (r.freq === "DAILY") return n > 1 ? `Every ${n} days` : "Daily";
  if (r.freq === "WEEKLY") {
    const codes = (r.byday || "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
    const days = (codes.length ? codes : r.startISO ? [DOW[dayOfWeek(r.startISO)]] : [])
      .map((c) => DAY_SHORT[c] ?? c)
      .join(", ");
    const head = n > 1 ? `Every ${n} weeks` : "Weekly";
    return days ? `${head} on ${days}` : head;
  }
  if (r.freq === "MONTHLY") return `${n > 1 ? `Every ${n} months` : "Monthly"} on the ${ordinal(sd)}`;
  if (r.freq === "YEARLY") return `${n > 1 ? `Every ${n} years` : "Yearly"} on ${MONTHS[sm - 1]} ${sd}`;
  return "Repeats";
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { dayOfWeek, toDateColumn } from "@/lib/dates";

/**
 * When a person does their planned workout (v0.744), so a day's workouts can
 * be listed in time order with its sport events. A usual time per weekday,
 * and a time for one day that overrides it. Times are minutes from midnight;
 * null means no time (listed after the timed ones).
 */

const USUAL_KEY = (userId: string) => `workoutTimes:${userId}`;
const DAY_KEY = "workoutTime";

/** "12:00" or 720 → 720; null when it can't be read. */
export function parseTime(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < 1440) return raw;
  if (typeof raw !== "string") return null;
  if (/^\d{1,4}$/.test(raw.trim())) return parseTime(Number(raw.trim()));
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** 720 → "12:00 PM". */
export function timeLabel(m: number): string {
  const h = Math.floor(m / 60) % 24;
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Sunday-first: seven times or nulls. */
export async function usualWorkoutTimes(userId: string): Promise<(number | null)[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: USUAL_KEY(userId) }, select: { value: true } });
  let raw: unknown = null;
  try {
    raw = row ? JSON.parse(row.value) : null;
  } catch {
    raw = null;
  }
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 7 }, (_, i) => parseTime(list[i]));
}

export async function setUsualWorkoutTimes(userId: string, times: unknown): Promise<(number | null)[]> {
  const list = Array.isArray(times) ? times : [];
  const clean = Array.from({ length: 7 }, (_, i) => parseTime(list[i]));
  await prisma.appSetting.upsert({
    where: { key: USUAL_KEY(userId) },
    create: { key: USUAL_KEY(userId), value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  });
  return clean;
}

/** The day's workout time: the day's own, else the weekday's usual. */
export async function workoutTimeFor(
  userId: string,
  dateISO: string,
): Promise<{ time: number | null; usual: number | null; changed: boolean }> {
  const [usual, dayRow] = await Promise.all([
    usualWorkoutTimes(userId),
    prisma.workoutSuggestionAnswer.findUnique({
      where: { userId_date_key_slot: { userId, date: toDateColumn(dateISO), key: DAY_KEY, slot: "" } },
      select: { answer: true },
    }),
  ]);
  const u = usual[dayOfWeek(dateISO)];
  const own = dayRow ? parseTime(dayRow.answer) : null;
  return { time: own ?? u, usual: u, changed: own != null };
}

/** Sets (or, with null, clears) one day's workout time. */
export async function setWorkoutTimeFor(userId: string, dateISO: string, time: unknown): Promise<void> {
  const date = toDateColumn(dateISO);
  const t = parseTime(time);
  if (t == null) {
    await prisma.workoutSuggestionAnswer.deleteMany({ where: { userId, date, key: DAY_KEY, slot: "" } });
    return;
  }
  await prisma.workoutSuggestionAnswer.upsert({
    where: { userId_date_key_slot: { userId, date, key: DAY_KEY, slot: "" } },
    create: { userId, date, key: DAY_KEY, slot: "", answer: String(t) },
    update: { answer: String(t) },
  });
}

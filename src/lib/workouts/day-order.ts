import "server-only";
import { getSetting, setSetting, clearSetting } from "@/lib/settings";
import { cleanOrder, DEFAULT_ORDER, type SectionKind } from "@/lib/workouts/blocks";

/**
 * The order a person's day page lists its sections in (v0.615): one order
 * for every day, and optionally a different one for a weekday. Kept in
 * settings: `workouts.order.<userId>` and `workouts.order.<userId>.<0-6>`.
 */
const key = (userId: string, day?: number | null) =>
  day == null ? `workouts.order.${userId}` : `workouts.order.${userId}.${day}`;

async function read(k: string): Promise<SectionKind[] | null> {
  const raw = await getSetting(k);
  if (!raw) return null;
  try {
    return cleanOrder(JSON.parse(raw));
  } catch {
    return null;
  }
}

export type DayOrders = {
  /** Every day's order. */
  everyDay: SectionKind[];
  /** Weekdays (0 = Sunday) with an order of their own. */
  days: Record<number, SectionKind[]>;
};

export async function loadDayOrders(userId: string): Promise<DayOrders> {
  const [everyDay, ...perDay] = await Promise.all([
    read(key(userId)),
    ...[0, 1, 2, 3, 4, 5, 6].map((d) => read(key(userId, d))),
  ]);
  const days: Record<number, SectionKind[]> = {};
  perDay.forEach((o, d) => {
    if (o) days[d] = o;
  });
  return { everyDay: everyDay ?? [...DEFAULT_ORDER], days };
}

/** The order for one weekday: its own, else every day's. */
export async function orderForDay(userId: string, day: number): Promise<SectionKind[]> {
  return (await read(key(userId, day))) ?? (await read(key(userId))) ?? [...DEFAULT_ORDER];
}

/**
 * Save an order. `day` null = every day; a weekday = that day only. A null
 * `order` puts that weekday back on every day's order (or every day back on
 * the default).
 */
export async function saveDayOrder(userId: string, day: number | null, order: unknown): Promise<void> {
  if (day != null && !(Number.isInteger(day) && day >= 0 && day <= 6)) return;
  const k = key(userId, day);
  if (order == null) {
    await clearSetting(k);
    return;
  }
  await setSetting(k, JSON.stringify(cleanOrder(order)));
}

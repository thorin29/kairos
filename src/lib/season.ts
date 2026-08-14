import "server-only";
import { addDays, daysBetween, formatMonth, formatShort, startOfMonth, todayISO } from "@/lib/dates";
import { getSeasonConfig, type SeasonConfig } from "@/lib/settings";

export type SeasonWindow = {
  startISO: string;
  endISO: string;
  label: string;
  weeks: number;
};

/**
 * The season window containing a given day. Calendar month by default; in
 * "weeks" mode, fixed N-week windows counted from an anchor so a lighter
 * workload can run a longer season and still reach a satisfying ladder.
 */
export function resolveSeasonWindow(
  cfg: SeasonConfig,
  dayISO: string,
): SeasonWindow {
  if (cfg.mode === "weeks") {
    const anchor = cfg.anchor ?? startOfMonth(dayISO);
    const periodDays = cfg.weeks * 7;
    const elapsed = Math.max(0, daysBetween(anchor, dayISO));
    const index = Math.floor(elapsed / periodDays);
    const startISO = addDays(anchor, index * periodDays);
    const endISO = addDays(startISO, periodDays - 1);
    return {
      startISO,
      endISO,
      label: `${formatShort(startISO)} \u2013 ${formatShort(endISO)}`,
      weeks: cfg.weeks,
    };
  }

  const startISO = startOfMonth(dayISO);
  const endISO = addDays(addMonthStart(startISO), -1);
  return {
    startISO,
    endISO,
    label: formatMonth(startISO),
    weeks: 4,
  };
}

// A month's last day = day before the first of next month.
function addMonthStart(monthStartISO: string): string {
  const [y, m] = monthStartISO.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

export async function currentSeasonWindow(
  dayISO: string = todayISO(),
): Promise<SeasonWindow> {
  const cfg = await getSeasonConfig();
  return resolveSeasonWindow(cfg, dayISO);
}

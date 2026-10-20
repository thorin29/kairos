/**
 * The one rule for a birthday someone types or picks, shared by the web
 * profile form and the phone (`/api/v1/me/birthday`): a real calendar date
 * (no February 30th), not before 1900, not in the future. Empty clears it.
 * Pure, so the browser can use it to check a typed date before saving.
 */
export function checkBirthday(
  raw: string,
  todayISO: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = raw.trim();
  if (v === "") return { ok: true, value: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return { ok: false, error: "That birthday isn't a valid date." };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (mo < 1 || mo > 12 || d < 1 || d > days) {
    return { ok: false, error: "That birthday isn't a valid date." };
  }
  if (y < 1900) return { ok: false, error: "Use a year from 1900 on." };
  if (v > todayISO) return { ok: false, error: "A birthday can't be in the future." };
  return { ok: true, value: v };
}

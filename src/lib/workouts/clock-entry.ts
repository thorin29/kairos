/**
 * Times typed as minutes and seconds (v0.642), the way a microwave takes
 * them: digits fill from the right, so 1, 2, 6 reads 1:26. Kept as seconds.
 */
export function clockText(seconds: number | string | null | undefined): string {
  const n = typeof seconds === "string" ? Number(seconds) : seconds;
  if (n == null || !Number.isFinite(n) || n < 0 || (typeof seconds === "string" && seconds.trim() === "")) return "";
  const s = Math.round(n);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What was typed ("2:06", "206", "2:065") → seconds as text ("126"); "" when empty. */
export function secondsFromTyped(typed: string): string {
  const d = typed.replace(/\D/g, "").replace(/^0+/, "").slice(0, 4);
  if (!d) return "";
  const n = Number(d);
  return String(Math.floor(n / 100) * 60 + (n % 100));
}

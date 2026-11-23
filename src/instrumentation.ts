/**
 * Runs once when the server starts (Next's instrumentation hook). Starts the
 * one background timer (v0.772): safety "no update" alerts and handing over
 * notifications held for quiet hours. Every 5 minutes; a slow or failed run
 * just waits for the next.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTimers } = await import("@/lib/timers");
  startTimers();
}

import "server-only";

const EVERY_MS = 5 * 60_000;
let started = false;

/** The background timer (see src/instrumentation.ts). */
export function startTimers(): void {
  if (started) return;
  started = true;
  let last = new Date();
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    const since = last;
    last = new Date();
    try {
      const { checkStale } = await import("@/lib/places/safety");
      await checkStale();
    } catch (e) {
      console.warn(`[timers] safety check failed: ${(e as Error).message}`);
    }
    try {
      const { morningChoreTurns } = await import("@/lib/notify-news");
      await morningChoreTurns();
    } catch (e) {
      console.warn(`[timers] chore turns failed: ${(e as Error).message}`);
    }
    try {
      const { backpackingTick } = await import("@/lib/workouts/backpacking");
      await backpackingTick();
    } catch (e) {
      console.warn(`[timers] backpacking failed: ${(e as Error).message}`);
    }
    try {
      // Places page (v0.795): write finished days as visits, a few per run.
      const { snapshotTick } = await import("@/lib/places/visits");
      await snapshotTick();
    } catch (e) {
      console.warn(`[timers] visit snapshot failed: ${(e as Error).message}`);
    }
    try {
      const { pingDue } = await import("@/lib/push");
      await pingDue(since);
    } catch (e) {
      console.warn(`[timers] held notifications failed: ${(e as Error).message}`);
    }
    running = false;
  };
  setInterval(() => void tick(), EVERY_MS).unref();
}

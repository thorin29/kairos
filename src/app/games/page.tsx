import { todayISO } from "@/lib/dates";
import { loadGameMonitor } from "@/lib/queries/game-monitor";
import { personalVisibleIds } from "@/lib/personal-scope";
import { SectionHeading } from "@/components/ui";
import { GamepadIcon } from "@/components/icons";
import { GameCards } from "@/components/game-cards";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const [rows, visible] = await Promise.all([
    loadGameMonitor(todayISO()),
    personalVisibleIds(),
  ]);
  const scoped = visible ? rows.filter((r) => visible.includes(r.userId)) : rows;

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      {scoped.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
          <GamepadIcon className="mx-auto h-8 w-8 text-muted" />
          <h2 className="mt-3 font-display text-lg font-semibold">No game time yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Once the kids play, their time and games show up here — pulled
            automatically from Xbox and Steam.
          </p>
        </div>
      ) : (
        <>
          <SectionHeading>Game time</SectionHeading>
          <GameCards rows={scoped} />
        </>
      )}
    </main>
  );
}

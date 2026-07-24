import { loadGameStatus } from "@/lib/queries/games";
import { todayISO } from "@/lib/dates";
import { AdminBack } from "@/components/admin-back";
import { GameSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AdminGamesPage() {
  const statuses = await loadGameStatus(todayISO());

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Game time
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          A daily allowance plus a few tokens a week that buy extra minutes.
          Tokens reset every Sunday, and unused ones don&rsquo;t carry over.
        </p>
      </header>

      <div className="space-y-4">
        {statuses.map((s) => (
          <GameSettingsForm key={s.userId} status={s} />
        ))}
      </div>
    </main>
  );
}

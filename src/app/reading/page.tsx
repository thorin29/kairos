import { loadReading } from "@/lib/queries/reading";
import { personalUserId } from "@/lib/personal-scope";
import { ReadingBoard } from "./reading-board";

export const dynamic = "force-dynamic";

export default async function ReadingPage({ searchParams }: { searchParams: Promise<{ person?: string }> }) {
  const [people, meId, { person }] = await Promise.all([loadReading(), personalUserId(), searchParams]);
  // A person's own reading (v0.803): from their home tile, or on their phone.
  const only = meId ?? (person && people.some((p) => p.id === person) ? person : null);
  const shown = only ? people.filter((p) => p.id === only) : people;

  return (
    <main className="mx-auto max-w-3xl px-6 py-6">
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
          Add people to the household to start tracking reading.
        </p>
      ) : (
        <ReadingBoard people={shown} />
      )}
    </main>
  );
}

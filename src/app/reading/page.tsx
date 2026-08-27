import { loadReading } from "@/lib/queries/reading";
import { personalUserId } from "@/lib/personal-scope";
import { ReadingBoard } from "./reading-board";

export const dynamic = "force-dynamic";

export default async function ReadingPage() {
  const [people, meId] = await Promise.all([loadReading(), personalUserId()]);
  const shown = meId ? people.filter((p) => p.id === meId) : people;

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

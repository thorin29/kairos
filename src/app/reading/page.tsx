import { loadReading } from "@/lib/queries/reading";
import { todayISO } from "@/lib/dates";
import { ReadingBoard } from "./reading-board";

export const dynamic = "force-dynamic";

export default async function ReadingPage() {
  const today = todayISO();
  const people = await loadReading();

  return (
    <>
      

      <main className="mx-auto max-w-3xl px-6 py-6">
        {people.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
            Add people to the household to start tracking reading.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              Personal reading &mdash; nudges your Scholar level up a little.
            </p>
            <ReadingBoard people={people} />
          </>
        )}
      </main>
    </>
  );
}

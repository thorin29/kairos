import { AdminBack } from "@/components/admin-back";
import { loadReadingProgress } from "@/lib/queries/reading-progress";
import { todayISO } from "@/lib/dates";
import { BookProgress } from "../book-progress";

export const dynamic = "force-dynamic";

export default async function FamilyProgressPage() {
  const progress = await loadReadingProgress(todayISO());

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Family reading progress
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          A darker book is fully read; a lighter one is part way through.
          Chapters the plan has already covered fill in on their own — tap a
          book to mark what was read before or outside the plan, then save.
        </p>
      </header>

      <BookProgress
        initialManual={progress.manualCovered}
        planCovered={progress.planCovered}
      />
    </main>
  );
}

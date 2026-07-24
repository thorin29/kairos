import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadCoverage } from "@/lib/queries/reading-coverage";
import { addDays, fromDateColumn, todayISO } from "@/lib/dates";
import { AdminBack } from "@/components/admin-back";
import { GenerateForm } from "./generate-form";

export const dynamic = "force-dynamic";

export default async function GeneratePlanPage() {
  const today = todayISO();

  const published = await prisma.readingPlan.findFirst({
    where: { isPublished: true },
  });

  const last = published
    ? await prisma.readingDay.findFirst({
        where: { planId: published.id },
        orderBy: { day: "desc" },
      })
    : null;

  // The obvious start is the morning after the current plan runs out, so two
  // plans never overlap on the same day.
  const lastISO = last ? fromDateColumn(last.day) : null;
  const defaultStart =
    lastISO && lastISO >= today ? addDays(lastISO, 1) : addDays(today, 1);

  const coverage = await loadCoverage(published?.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Build a plan
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Pick the books, say how fast, and the dates fall out of it. The
          preview updates as you go and nothing is saved until you say so
          &mdash; and what is saved is a draft, same as an import.
        </p>
        <p className="mt-3 text-sm text-muted">
          Already have a schedule written?{" "}
          <Link href="/admin/bible" className="text-accent underline">
            Import it instead
          </Link>
          .
        </p>
      </header>

      <GenerateForm
        defaultStart={defaultStart}
        carryOn={coverage.remaining}
        carryOnChapters={coverage.remainingChapters}
        publishedName={published?.name ?? null}
      />
    </main>
  );
}

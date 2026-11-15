import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, todayISO } from "@/lib/dates";
import { AdminBack } from "@/components/admin-back";
import { AddReadings } from "@/components/add-readings";

export const dynamic = "force-dynamic";

export default async function AddFamilyReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planId } = await searchParams;
  const plan = planId
    ? await prisma.readingPlan.findFirst({
        where: { id: planId, ownerId: null },
        include: { days: { orderBy: { day: "asc" } } },
      })
    : null;
  if (!plan) notFound();

  const today = todayISO();
  const start = plan.startDate ? fromDateColumn(plan.startDate) : today;
  const days = plan.days.map((d) => ({ iso: fromDateColumn(d.day), passage: d.passage, isExtra: d.isExtra, extra: d.extra }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />
      <header className="mb-6 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Add readings</h1>
        <p className="mt-1 text-muted">{plan.name}</p>
      </header>
      <AddReadings
        planId={plan.id}
        days={days}
        defaultStartISO={start > today ? start : today}
        backHref="/admin/bible"
        endsWhenDone={plan.endKind === "DONE"}
      />
    </main>
  );
}

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/user-session";
import { fromDateColumn, todayISO } from "@/lib/dates";
import { AddReadings } from "@/components/add-readings";

export const dynamic = "force-dynamic";

export default async function AddMyReadingsPage() {
  const me = await currentUser();
  if (!me) redirect("/bible");
  const plan = await prisma.readingPlan.findFirst({
    where: { ownerId: me.id },
    orderBy: { createdAt: "desc" },
    include: { days: { orderBy: { day: "asc" } } },
  });
  if (!plan) redirect("/bible");

  const today = todayISO();
  const start = plan.startDate ? fromDateColumn(plan.startDate) : today;
  const days = plan.days.map((d) => ({ iso: fromDateColumn(d.day), passage: d.passage, isExtra: d.isExtra, extra: d.extra }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Add readings</h1>
        <p className="mt-1 text-muted">{plan.name}</p>
      </header>
      <AddReadings planId={plan.id} days={days} defaultStartISO={start > today ? start : today} backHref="/bible" />
    </main>
  );
}

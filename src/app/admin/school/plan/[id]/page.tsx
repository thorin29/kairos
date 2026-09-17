import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminBack } from "@/components/admin-back";
import { loadClassPlanDetail } from "@/lib/queries/class-plan";
import { PlanReview } from "./plan-review";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ClassPlanReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await loadClassPlanDetail(id);
  if (!plan) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />
      <Link
        href="/admin/school/curriculum"
        className="mt-3 inline-block text-sm text-muted hover:text-ink"
      >
        &lsaquo; Curriculum &amp; schedule
      </Link>
      <PlanReview plan={plan} today={todayISO()} />
    </main>
  );
}

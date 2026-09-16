import { notFound } from "next/navigation";
import { AdminBack } from "@/components/admin-back";
import { loadClassPlanDetail } from "@/lib/queries/class-plan";
import { PlanReview } from "./plan-review";

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
      <PlanReview plan={plan} />
    </main>
  );
}

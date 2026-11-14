import { redirect } from "next/navigation";
import { currentUser } from "@/lib/user-session";
import { PlanImport } from "@/components/plan-import";

export const dynamic = "force-dynamic";

export default async function ImportMyPlanPage() {
  const me = await currentUser();
  if (!me) redirect("/bible");
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Import a plan</h1>
      </header>
      <PlanImport target={{ scope: "mine", userId: me.id }} doneHref="/bible" />
    </main>
  );
}

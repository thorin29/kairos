import { AdminBack } from "@/components/admin-back";
import { LockButton } from "../lock-button";
import { getHockeyConfig } from "@/lib/hockey";
import { HockeyForm } from "./hockey-form";

export const dynamic = "force-dynamic";

export default async function HockeyAdminPage() {
  const initial = await getHockeyConfig();

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Hockey</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Ice times come from an ice-time container, which reads the rink&rsquo;s
            schedules. Kairos asks it for the week whenever Hockey opens. Leave the
            address blank to hide Hockey.
          </p>
        </div>
        <LockButton />
      </header>

      <HockeyForm initial={initial} />
    </main>
  );
}

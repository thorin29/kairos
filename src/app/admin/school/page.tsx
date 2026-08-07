import { AdminBack } from "@/components/admin-back";
import { SectionHeading } from "@/components/ui";
import { loadSchoolAdmin } from "@/lib/queries/school";
import { todayISO } from "@/lib/dates";
import { SchoolAdmin } from "./school-admin";

export const dynamic = "force-dynamic";

export default async function AdminSchoolPage() {
  const people = await loadSchoolAdmin();
  const today = todayISO();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          School
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Assignments and tests across the household. Students can add their own
          from their day; here a parent can add for anyone and clear things out.
          Timed classes live on the calendar. School work is tracked but stays
          out of the score for now.
        </p>
      </header>

      <section>
        <SectionHeading>Open work</SectionHeading>
        <div className="mt-3">
          <SchoolAdmin people={people} today={today} />
        </div>
      </section>
    </main>
  );
}

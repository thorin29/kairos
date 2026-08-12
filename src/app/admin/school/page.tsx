import { AdminBack } from "@/components/admin-back";
import { SectionHeading } from "@/components/ui";
import {
  loadSchoolAdmin,
  loadSchoolStructure,
  loadClassOptions,
  loadRolloverState,
} from "@/lib/queries/school";
import { todayISO } from "@/lib/dates";
import { SchoolAdmin } from "./school-admin";
import { SchoolStructure } from "./school-structure";
import { RolloverBanner } from "./rollover-banner";

export const dynamic = "force-dynamic";

export default async function AdminSchoolPage() {
  const today = todayISO();
  const [people, structure, classOptions, rollover] = await Promise.all([
    loadSchoolAdmin(),
    loadSchoolStructure(),
    loadClassOptions(),
    loadRolloverState(today),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          School
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Terms and classes, plus assignments and tests across the household. A
          class with a meeting time shows on the calendar automatically. School
          work is tracked but stays out of the score for now.
        </p>
      </header>

      {rollover.needed && <RolloverBanner state={rollover} />}

      <section className="mb-12">
        <SectionHeading>Terms &amp; classes</SectionHeading>
        <div className="mt-3">
          <SchoolStructure
            terms={structure.terms}
            people={structure.people}
            subjects={structure.subjects}
            classTypes={structure.classTypes}
            today={today}
          />
        </div>
      </section>

      <section>
        <SectionHeading>Open work</SectionHeading>
        <div className="mt-3">
          <SchoolAdmin
            people={people}
            classesByUser={classOptions}
            subjects={structure.subjects.map((s) => s.name)}
            today={today}
          />
        </div>
      </section>
    </main>
  );
}

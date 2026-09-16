import { AdminBack } from "@/components/admin-back";
import { SectionHeading } from "@/components/ui";
import {
  loadSchoolAdmin,
  loadSchoolStructure,
  loadClassOptions,
  loadRolloverState,
} from "@/lib/queries/school";
import { todayISO } from "@/lib/dates";
import { getClassFromCalendarMode } from "@/lib/settings";
import { SchoolAdmin } from "./school-admin";
import { SchoolStructure } from "./school-structure";
import { ClassAccessToggle } from "./class-access-toggle";
import { RolloverBanner } from "./rollover-banner";
import Link from "next/link";
import { loadClassPlans } from "@/lib/queries/class-plan";
import { loadTermCompileOptions } from "@/lib/queries/term-compile";
import { CurriculumPlans } from "./curriculum-plans";

export const dynamic = "force-dynamic";

export default async function AdminSchoolPage() {
  const today = todayISO();
  const [people, structure, classOptions, rollover, classMode, classPlans, termOptions] =
    await Promise.all([
      loadSchoolAdmin(),
      loadSchoolStructure(),
      loadClassOptions(),
      loadRolloverState(today),
      getClassFromCalendarMode(),
      loadClassPlans(),
      loadTermCompileOptions(),
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
        <Link
          href="/admin/school/year"
          className="flex items-center justify-between rounded-lg border border-accent bg-accent/10 px-4 py-3 text-sm hover:brightness-105"
        >
          <span>
            <span className="font-medium text-accent">Set up school year</span>
            <span className="ml-2 text-xs text-muted">
              semesters, breaks &amp; the calendar &mdash; define these before adding classes
            </span>
          </span>
          <span className="text-accent">&rarr;</span>
        </Link>
      </section>

      <section className="mb-12">
        <SectionHeading>Terms &amp; classes</SectionHeading>
        <div className="mt-3 space-y-4">
          <ClassAccessToggle mode={classMode} />
          <SchoolStructure
            terms={structure.terms}
            people={structure.people}
            subjects={structure.subjects}
            classTypes={structure.classTypes}
            today={today}
          />
        </div>
      </section>

      <section className="mb-12">
        <SectionHeading>Curriculum plans</SectionHeading>
        <div className="mt-3">
          <CurriculumPlans plans={classPlans} />
        </div>
      </section>

      <section className="mb-12">
        <SectionHeading>Term schedule</SectionHeading>
        <div className="mt-3">
          {termOptions.length === 0 ? (
            <p className="text-sm text-muted">
              Publish a class plan to compile a student&rsquo;s whole-term schedule here.
            </p>
          ) : (
            <ul className="space-y-2">
              {termOptions.map((o) => (
                <li key={`${o.termId}|${o.studentId}`}>
                  <Link
                    href={`/admin/school/term/${o.termId}/${o.studentId}`}
                    className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3 text-sm hover:border-accent"
                  >
                    <span>
                      <span className="font-medium">{o.studentName}</span>
                      <span className="text-muted"> &middot; {o.termName}</span>
                    </span>
                    <span className="text-xs font-medium text-accent">Compile &amp; balance</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
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

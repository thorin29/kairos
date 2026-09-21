import Link from "next/link";
import { AdminBack } from "@/components/admin-back";
import { SectionHeading } from "@/components/ui";
import { loadClassPlans } from "@/lib/queries/class-plan";
import { loadTermCompileOptions } from "@/lib/queries/term-compile";
import { loadSchoolStructure } from "@/lib/queries/school";
import { loadYearCalendar, loadStudentBars } from "@/lib/queries/school-year";
import { CurriculumPlans } from "../curriculum-plans";
import { ClassPlanForm } from "../class-plan-form";
import { YearCalendar } from "../year/year-calendar";

export const dynamic = "force-dynamic";

export default async function SchoolCurriculumPage() {
  const [classPlans, termOptions, structure, cal, students] = await Promise.all([
    loadClassPlans(),
    loadTermCompileOptions(),
    loadSchoolStructure(),
    loadYearCalendar(),
    loadStudentBars(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />
      <Link href="/admin/school" className="mt-3 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 hover:border-accent">
        &lsaquo; School
      </Link>
      <header className="mb-6 mt-3 border-b border-hairline pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Curriculum &amp; schedule</h1>
      </header>

      {cal.hasYear && (
        <section className="mb-10">
          <SectionHeading>Year calendar</SectionHeading>
          <p className="mb-3 mt-1 text-xs text-muted">
            Pick a student, then a class, to see how it lays out over the year.
          </p>
          <YearCalendar cal={cal} students={students} />
        </section>
      )}

      <section className="mb-10">
        <SectionHeading>Curriculum plans</SectionHeading>
        <div className="mt-3 space-y-4">
          <CurriculumPlans plans={classPlans} />
          <ClassPlanForm
            students={structure.people.map((p) => ({ id: p.id, name: p.name }))}
            subjects={structure.subjects.map((s) => s.name)}
          />
        </div>
      </section>

      <section>
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
    </main>
  );
}

import { AdminBack } from "@/components/admin-back";
import Link from "next/link";
import { SectionHeading } from "@/components/ui";
import { loadSchoolYear, loadYearCalendar, loadStudentBars } from "@/lib/queries/school-year";
import { SchoolYearSetup } from "./school-year-setup";
import { YearCalendar } from "./year-calendar";

export const dynamic = "force-dynamic";

export default async function SchoolYearPage() {
  const [year, cal, students] = await Promise.all([
    loadSchoolYear(),
    loadYearCalendar(),
    loadStudentBars(),
  ]);
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />
      <Link href="/admin/school" className="mt-3 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 hover:border-accent">
        &lsaquo; School
      </Link>
      <SchoolYearSetup year={year} />
      <section className="mt-10">
        <SectionHeading>Year calendar</SectionHeading>
        <div className="mt-3">
          <YearCalendar cal={cal} students={students} />
        </div>
      </section>
    </main>
  );
}

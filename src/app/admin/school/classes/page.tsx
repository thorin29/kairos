import Link from "next/link";
import { AdminBack } from "@/components/admin-back";
import { todayISO } from "@/lib/dates";
import { getClassFromCalendarMode } from "@/lib/settings";
import { loadSchoolStructure, loadSubjectGroups } from "@/lib/queries/school";
import { SchoolStructure } from "../school-structure";
import { ClassAccessToggle } from "../class-access-toggle";

export const dynamic = "force-dynamic";

export default async function SchoolClassesPage() {
  const today = todayISO();
  const [structure, groups, classMode] = await Promise.all([
    loadSchoolStructure(),
    loadSubjectGroups(),
    getClassFromCalendarMode(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />
      <Link href="/admin/school" className="mt-3 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 hover:border-accent">
        &lsaquo; School
      </Link>
      <header className="mb-6 mt-3 border-b border-hairline pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Classes &amp; subjects</h1>
      </header>
      <div className="space-y-4">
        <ClassAccessToggle mode={classMode} />
        <SchoolStructure
          terms={structure.terms}
          people={structure.people}
          subjects={structure.subjects}
          classTypes={structure.classTypes}
          groups={groups}
          today={today}
        />
      </div>
    </main>
  );
}

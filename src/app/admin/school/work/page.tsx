import Link from "next/link";
import { AdminBack } from "@/components/admin-back";
import { todayISO } from "@/lib/dates";
import { loadSchoolAdmin, loadClassOptions, loadSchoolStructure } from "@/lib/queries/school";
import { SchoolAdmin } from "../school-admin";

export const dynamic = "force-dynamic";

export default async function SchoolWorkPage() {
  const today = todayISO();
  const [people, classOptions, structure] = await Promise.all([
    loadSchoolAdmin(),
    loadClassOptions(),
    loadSchoolStructure(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />
      <Link href="/admin/school" className="mt-3 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 hover:border-accent">
        &lsaquo; School
      </Link>
      <header className="mb-6 mt-3 border-b border-hairline pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Student work</h1>
      </header>
      <SchoolAdmin
        people={people}
        classesByUser={classOptions}
        subjects={structure.subjects.map((s) => s.name)}
        today={today}
      />
    </main>
  );
}

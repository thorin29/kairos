import { AdminBack } from "@/components/admin-back";
import { loadSchoolYear } from "@/lib/queries/school-year";
import { SchoolYearSetup } from "./school-year-setup";

export const dynamic = "force-dynamic";

export default async function SchoolYearPage() {
  const year = await loadSchoolYear();
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />
      <SchoolYearSetup year={year} />
    </main>
  );
}

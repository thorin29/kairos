import { notFound } from "next/navigation";
import { AdminBack } from "@/components/admin-back";
import { loadTermCompile } from "@/lib/queries/term-compile";
import { TermCompileView } from "./term-compile";

export const dynamic = "force-dynamic";

export default async function TermCompilePage({
  params,
}: {
  params: Promise<{ termId: string; studentId: string }>;
}) {
  const { termId, studentId } = await params;
  const data = await loadTermCompile(termId, studentId);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />
      <TermCompileView data={data} />
    </main>
  );
}

import { loadCoop } from "@/lib/queries/coop";
import { isAdmin } from "@/lib/session";
import { CoopBoard } from "./page-client";

export const dynamic = "force-dynamic";

export default async function CoopPage() {
  const [data, admin] = await Promise.all([loadCoop(), isAdmin()]);

  return (
    <>
      
      <main className="mx-auto max-w-2xl px-6 py-6">
        <CoopBoard data={data} isAdmin={admin} />
      </main>
    </>
  );
}

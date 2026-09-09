import { redirect } from "next/navigation";
import { AdminBack } from "@/components/admin-back";
import { currentAdmin } from "@/lib/session";
import { getAppearance } from "@/lib/settings";
import { AppearanceAdmin } from "./appearance-admin";

export const dynamic = "force-dynamic";

export default async function AdminAppearancePage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/unlock");
  const { theme, dark } = await getAppearance();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Appearance
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          A colour theme and dark mode for the whole household&rsquo;s web view.
          Everyone sees the same look here; the phone app has its own per-device
          setting.
        </p>
      </header>

      <AppearanceAdmin theme={theme} dark={dark} />
    </main>
  );
}

import { redirect } from "next/navigation";
import { AdminBack } from "@/components/admin-back";
import { currentAdmin } from "@/lib/session";
import { getAppearance, getFamilyColor, getFamilyAvatar } from "@/lib/settings";
import { AppearanceAdmin } from "./appearance-admin";

export const dynamic = "force-dynamic";

export default async function AdminAppearancePage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/unlock");
  const { theme, mode, background } = await getAppearance();
  const familyColor = await getFamilyColor();
  const familyAvatar = await getFamilyAvatar();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Appearance
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          The household&rsquo;s web view. Each phone picks its own in the app.
        </p>
      </header>

      <AppearanceAdmin
        theme={theme}
        mode={mode}
        background={background}
        familyColor={familyColor}
        familyAvatar={familyAvatar}
      />
    </main>
  );
}

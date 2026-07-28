import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { PinPad } from "@/components/pin-pad";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default async function UnlockPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <BackLink />

      <header className="mb-8 mt-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Kairos"
          className="mx-auto mb-4 h-20 w-20 rounded-2xl"
        />
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Admin PIN
        </h1>
        <p className="mt-2 text-sm text-muted">
          Unlocks the admin area for a few hours.
        </p>
      </header>

      <PinPad />
    </main>
  );
}

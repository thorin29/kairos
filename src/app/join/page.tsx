import { RedeemForm } from "./redeem-form";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

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
          Set up your account
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pick a password to sign in on your own device.
        </p>
      </header>

      {token ? (
        <RedeemForm token={token} />
      ) : (
        <div className="rounded-2xl border border-hairline bg-surface p-6 text-center text-sm text-muted">
          This link is missing its invite code. Open the exact link a parent
          gave you, or ask them to send a new one.
        </div>
      )}
    </main>
  );
}

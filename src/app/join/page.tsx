import { RedeemForm } from "./redeem-form";
import { inviteIsRedeemable } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Validate before showing the form. A used invite is deleted on redemption
  // and an expired one is past its date, so either way the form must not
  // reappear — otherwise a stale link looks reusable even though a dead token
  // can never set a password.
  const redeemable = token ? await inviteIsRedeemable(token) : false;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
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

      {redeemable ? (
        <RedeemForm token={token as string} />
      ) : (
        <div className="rounded-2xl border border-hairline bg-surface p-6 text-center text-sm text-muted">
          {token
            ? "This invite link has already been used or has expired. Ask a parent for a new one."
            : "This link is missing its invite code. Open the exact link a parent gave you, or ask them to send a new one."}
        </div>
      )}
    </main>
  );
}

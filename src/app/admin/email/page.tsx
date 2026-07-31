import { AdminBack } from "@/components/admin-back";
import { LockButton } from "../lock-button";
import { smtpForm } from "@/lib/mail/config";
import { SmtpForm } from "./smtp-form";

export const dynamic = "force-dynamic";

export default async function EmailAdminPage() {
  const initial = await smtpForm();

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Email
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            The SMTP server invites are sent through. Any field can instead be
            set as a container environment variable, which takes precedence.
            Proton Bridge works with STARTTLS, an accepted self-signed
            certificate, and TLS 1.2.
          </p>
        </div>
        <LockButton />
      </header>

      <SmtpForm initial={initial} />
    </main>
  );
}

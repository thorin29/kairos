import { redirect } from "next/navigation";
import { currentUser } from "@/lib/user-session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/** A relative in-app path, or "/" — never an absolute URL, so `next` can't be
 *  used to bounce a session somewhere off-site. */
function safeNext(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = safeNext(next);

  if (await currentUser()) redirect(dest);

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
          Sign in
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your personal account. The shared tablet doesn&rsquo;t need this.
        </p>
      </header>

      <LoginForm next={dest} />

      <p className="mt-8 text-center text-sm text-muted">
        No account yet? A parent can send you an invite from the household
        settings.
      </p>
    </main>
  );
}

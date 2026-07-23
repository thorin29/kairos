import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  let users;
  try {
    users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  } catch (e) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-lg border border-hairline bg-surface p-6">
          <h1 className="font-display text-xl font-semibold">
            Can&rsquo;t reach the database
          </h1>
          <p className="mt-2 text-sm text-muted">
            Check that DATABASE_URL points at the right host and that this
            container shares a network with Postgres.
          </p>
          <pre className="tabular mt-4 overflow-x-auto rounded bg-ground p-3 text-xs">
            {e instanceof Error ? e.message : "Unknown database error"}
          </pre>
        </div>
      </main>
    );
  }

  if (users.length === 0) redirect("/setup");

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-baseline justify-between border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Family Dashboard
        </h1>
        <p className="tabular text-sm text-muted">{today}</p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex items-center gap-3 rounded-lg border border-hairline bg-surface p-4"
          >
            <span
              aria-hidden
              className="h-9 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: u.color }}
            />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-tight">
                {u.displayName ?? u.name}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted">
                {u.role === "ADMIN" ? "Parent" : "Child"}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-center justify-between border-t border-hairline pt-6">
        <p className="text-sm text-muted">Connected. Overview cards come next.</p>
        <Link
          href="/setup"
          className="rounded-md border border-hairline px-4 py-2 text-sm font-medium hover:border-accent hover:text-accent"
        >
          Manage household
        </Link>
      </div>
    </main>
  );
}

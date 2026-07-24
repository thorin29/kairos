import { prisma } from "@/lib/prisma";
import { APP_VERSION, CHANGES, MIGRATIONS } from "@/lib/version";
import { BackLink } from "@/components/back-link";
import { Card, SectionHeading } from "@/components/ui";
import { CheckIcon, AlertIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * A build check. The version tells you which set of changes this instance
 * received; the migration list tells you whether the database actually got
 * them, which is the usual symptom of a partial upload.
 */
export default async function AboutPage() {
  let applied: string[] = [];
  let dbError: string | null = null;

  try {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at ASC
    `;
    applied = rows.map((r) => r.migration_name);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Could not read migrations";
  }

  const missing = MIGRATIONS.filter((m) => !applied.includes(m));

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <BackLink />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          About
        </h1>
        <p className="tabular mt-2 text-sm text-muted">
          Version {APP_VERSION}
        </p>
      </header>

      <section className="mb-10">
        <SectionHeading>Database</SectionHeading>
        <Card className="p-5">
          {dbError ? (
            <p className="text-sm text-red-700">{dbError}</p>
          ) : missing.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckIcon className="h-5 w-5" />
              All {MIGRATIONS.length} migrations applied
            </p>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm font-medium text-red-700">
                <AlertIcon className="h-5 w-5" />
                {missing.length} migration
                {missing.length === 1 ? "" : "s"} missing
              </p>
              <ul className="tabular mt-2 space-y-0.5 text-xs text-muted">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                A missing migration usually means its folder didn&rsquo;t
                upload. Check{" "}
                <code className="tabular">prisma/migrations</code> and restart
                the container.
              </p>
            </>
          )}

          <p className="tabular mt-4 border-t border-hairline pt-4 text-xs text-muted">
            {applied.length} applied &middot; {MIGRATIONS.length} expected
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading>Recent changes</SectionHeading>
        <Card className="divide-y divide-hairline">
          {CHANGES.map((c) => (
            <div key={c.version} className="p-5">
              <p className="tabular text-sm font-medium">{c.version}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {c.summary.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      </section>
    </main>
  );
}

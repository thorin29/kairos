import Link from "next/link";
import { Card } from "@/components/ui";

/**
 * Shown instead of a management screen when a child is signed in. It names
 * the reason and offers the way through rather than silently redirecting,
 * which just looks broken on a shared tablet.
 */
export function ParentOnly({ what }: { what: string }) {
  return (
    <Card className="p-8 text-center">
      <h2 className="font-display text-xl font-semibold">Parents only</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        {what} is managed by a parent account. Switch profiles and enter the
        PIN to continue.
      </p>
      <Link
        href="/switch"
        className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
      >
        Switch profile
      </Link>
    </Card>
  );
}

import { AdminBack } from "@/components/admin-back";
import { loadEventNameAdmin } from "@/lib/queries/event-names";
import { EventNamesAdmin } from "./event-names-admin";

export const dynamic = "force-dynamic";

export default async function AdminEventNamesPage() {
  const { names } = await loadEventNameAdmin();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Event names
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          The names offered when you create a calendar event. The list grows on
          its own — any name typed on an event is remembered here — so this page
          is for tidying it: fix spelling and capitalization, merge duplicates, or
          remove ones you don&apos;t want suggested. It&apos;s one alphabetical
          list, shown on every event. Removing a name here doesn&apos;t change
          events already saved.
        </p>
      </header>

      <EventNamesAdmin names={names} />
    </main>
  );
}

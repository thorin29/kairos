import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadHockey, hockeyEventTypeId, getHockeyPrefs } from "@/lib/hockey";
import { arrangeSections } from "@/lib/hockey-view";
import { loadEventTypes } from "@/lib/queries/calendar";
import { loadClassCtx } from "@/lib/queries/class-ctx";
import { currentUser } from "@/lib/user-session";
import { deviceMode } from "@/lib/device";
import { todayISO } from "@/lib/dates";
import { AddEventProvider } from "@/app/calendar/add-event-form";
import { HockeyBoard } from "./hockey-board";

export const dynamic = "force-dynamic";

export default async function HockeyPage() {
  const load = await loadHockey();

  if (load.state !== "ok") {
    return (
      <main className="mx-auto max-w-[72rem] px-6 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Hockey</h1>
        <div className="mt-6 rounded-2xl border border-hairline bg-surface p-6 text-sm">
          {load.state === "off" ? (
            <p>
              Hockey isn&rsquo;t set up yet. An admin can connect ice-time under{" "}
              <Link href="/admin/hockey" className="font-medium text-accent hover:underline">
                Admin → Hockey
              </Link>
              .
            </p>
          ) : (
            <p className="text-red-700">{load.error}</p>
          )}
        </div>
      </main>
    );
  }

  const [people, types, classCtx, typeId, me, mode] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true },
    }),
    loadEventTypes(),
    loadClassCtx(),
    hockeyEventTypeId(),
    currentUser(),
    deviceMode(),
  ]);
  const prefs = await getHockeyPrefs(me?.id);

  return (
    <AddEventProvider
      people={(people as { id: string; name: string; displayName: string | null }[]).map((p) => ({
        id: p.id,
        name: p.displayName ?? p.name,
      }))}
      types={types}
      classCtx={classCtx}
      defaultDate={todayISO()}
    >
      <HockeyBoard
        view={load.view}
        sections={arrangeSections(load.view.sections, prefs)}
        canSave={Boolean(me)}
        eventTypeId={typeId}
        // On someone's own device the event is theirs; on the shared tablet
        // the form asks whose it is.
        ownerId={me && mode === "personal" ? me.id : null}
      />
    </AddEventProvider>
  );
}

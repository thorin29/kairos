import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { loadLive, mapConfig } from "@/lib/places/live";
import { loadDay } from "@/lib/places/history";
import { PlacesView } from "./places-view";
import { HistoryView } from "./[personId]/history-view";
import { EmbedProvider } from "./embed-context";

/**
 * The Places pages, shared by the web (/places) and the phone app's WebView
 * (/places/embed, v0.762). In the app there's no sidebar, no Admin link and
 * no "Not right?"; data comes through the app's Places cookie.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function NotSetUp({ embed }: { embed: boolean }) {
  return (
    <main className={embed ? "px-4 py-6" : "mx-auto max-w-[72rem] px-6 py-8"}>
      {!embed && <h1 className="font-display text-3xl font-semibold tracking-tight">Places</h1>}
      <div className="mt-6 rounded-2xl border border-hairline bg-surface p-6 text-sm">
        {embed ? (
          <p>Places isn&rsquo;t set up yet.</p>
        ) : (
          <p>
            Places isn&rsquo;t set up yet. An admin adds the Google map key, Map ID and each person&rsquo;s tracker
            under{" "}
            <Link href="/admin/places" className="font-medium text-accent hover:underline">
              Admin → Places
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}

const wrap = (embed: boolean, node: React.ReactNode) => (embed ? <EmbedProvider>{node}</EmbedProvider> : node);

export async function renderPlaces(embed: boolean) {
  const [cfg, tracked] = await Promise.all([mapConfig(), prisma.placesPerson.count()]);
  if (!cfg || tracked === 0) return <NotSetUp embed={embed} />;
  const live = await loadLive();
  return wrap(embed, <PlacesView mapKey={cfg.mapKey} mapId={cfg.mapId} initial={live} />);
}

export async function renderHistory(personId: string, rawDate: string | undefined, embed: boolean) {
  const today = todayISO();
  const date = rawDate && ISO.test(rawDate) && rawDate <= today ? rawDate : today;

  const [cfg, tracked] = await Promise.all([
    mapConfig(),
    prisma.placesPerson.findUnique({
      where: { userId: personId },
      select: {
        user: { select: { id: true, name: true, displayName: true, color: true, avatarPath: true, avatarPosition: true } },
      },
    }) as Promise<{
      user: { id: string; name: string; displayName: string | null; color: string; avatarPath: string | null; avatarPosition: string };
    } | null>,
  ]);
  if (!tracked) notFound();
  if (!cfg) return <NotSetUp embed={embed} />;

  const day = await loadDay(personId, date, { names: true });
  const u = tracked.user;
  return wrap(
    embed,
    <HistoryView
      mapKey={cfg.mapKey}
      mapId={cfg.mapId}
      person={{ id: u.id, name: u.displayName || u.name, color: u.color, avatarPath: u.avatarPath, avatarPosition: u.avatarPosition }}
      day={day}
      today={today}
    />,
  );
}

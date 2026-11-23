import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { mapConfig } from "@/lib/places/live";
import { loadDay } from "@/lib/places/history";
import { HistoryView } from "./history-view";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Places → a person's day: path, stops and trips, with replay (v0.758). */
export default async function PlacesHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { personId } = await params;
  const { date: rawDate } = await searchParams;
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
  if (!cfg) {
    return (
      <main className="mx-auto max-w-[72rem] px-6 py-8">
        <p className="text-sm">
          Places isn&rsquo;t set up yet.{" "}
          <Link href="/admin/places" className="font-medium text-accent hover:underline">
            Admin → Places
          </Link>
        </p>
      </main>
    );
  }

  const day = await loadDay(personId, date, { names: true });
  const u = tracked.user;
  return (
    <HistoryView
      mapKey={cfg.mapKey}
      mapId={cfg.mapId}
      person={{ id: u.id, name: u.displayName || u.name, color: u.color, avatarPath: u.avatarPath, avatarPosition: u.avatarPosition }}
      day={day}
      today={today}
    />
  );
}

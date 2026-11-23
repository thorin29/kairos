import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadLive, mapConfig } from "@/lib/places/live";
import { PlacesView } from "./places-view";

export const dynamic = "force-dynamic";

/** Places (v0.757): where everyone is, on one Google map. */
export default async function PlacesPage() {
  const [cfg, tracked] = await Promise.all([mapConfig(), prisma.placesPerson.count()]);

  if (!cfg || tracked === 0) {
    return (
      <main className="mx-auto max-w-[72rem] px-6 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Places</h1>
        <div className="mt-6 rounded-2xl border border-hairline bg-surface p-6 text-sm">
          <p>
            Places isn&rsquo;t set up yet. An admin adds the Google map key, Map ID and each person&rsquo;s
            tracker under{" "}
            <Link href="/admin/places" className="font-medium text-accent hover:underline">
              Admin → Places
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  const live = await loadLive();
  return <PlacesView mapKey={cfg.mapKey} mapId={cfg.mapId} initial={live} />;
}

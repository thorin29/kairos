import { AdminBack } from "@/components/admin-back";
import { AdminTabs, pickTab } from "@/components/admin-tabs";
import { loadPlacesAdmin } from "@/lib/places/config";
import { usageSummary } from "@/lib/places/usage";
import { householdTz } from "@/lib/dates";
import { PlacesAdminForm, type PersonView } from "./places-admin";
import { ZoneColors } from "./zone-colors";
import { zonesForAdmin } from "@/lib/places/zones-look";
import { confirmAllIds } from "@/lib/places/visits";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${min % 60} min ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export default async function PlacesAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const [data, usage, zones, confirmAll] = await Promise.all([loadPlacesAdmin(), usageSummary(), zonesForAdmin(), confirmAllIds()]);
  // Parents can always confirm everyone's places (v0.812).
  const parents = new Set(
    (
      (await prisma.user.findMany({
        where: { id: { in: data.people.map((p) => p.id) }, OR: [{ role: "ADMIN" }, { kind: "PARENT" }] },
        select: { id: true },
      })) as { id: string }[]
    ).map((u) => u.id),
  );
  const now = Date.now();
  const tz = householdTz();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
  const when = (iso: string) => `${time.format(new Date(iso))} · ${ago(iso, now)}`;

  const people: PersonView[] = data.people.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    avatarPath: p.avatarPath,
    avatarPosition: p.avatarPosition,
    entityId: p.entityId,
    parent: parents.has(p.id),
    confirmAll: parents.has(p.id) || confirmAll.includes(p.id),
    points: p.points,
    last: p.last
      ? {
          when: when(p.last.at),
          accuracy: p.last.accuracyM != null ? `±${Math.round(p.last.accuracyM)} m` : null,
          speed: p.last.speed != null ? `speed ${Math.round(p.last.speed * 10) / 10}` : null,
          battery: p.last.battery != null ? `${p.last.battery}%` : null,
        }
      : null,
  }));

  // Tabs (v0.797) instead of one long page.
  const tabs = [
    { key: "status", label: "Status" },
    { key: "people", label: "People", badge: data.unlinked ? 1 : 0 },
    { key: "places", label: "Places" },
    { key: "setup", label: "Setup" },
  ];
  const tab = pickTab(tabs, (await searchParams).tab) as "status" | "people" | "places" | "setup";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-4 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Family map</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Home Assistant sends each phone&rsquo;s location here. Setup steps are in
            docs/places-home-assistant.md.
          </p>
        </div>
      </header>

      <AdminTabs base="/admin/places" tabs={tabs} active={tab} />

      <PlacesAdminForm
        tab={tab}
        people={people}
        mapKeySet={data.mapKeySet}
        lookupKeySet={data.lookupKeySet}
        mapId={data.mapId}
        tokenMade={data.tokenCreatedAt ? time.format(new Date(data.tokenCreatedAt)) : null}
        lastReceived={data.lastReceivedAt ? when(data.lastReceivedAt) : null}
        unlinked={data.unlinked ? { entityId: data.unlinked.entityId, when: when(data.unlinked.at) } : null}
        totalPoints={data.totalPoints}
        usage={usage}
        named={data.named}
        rules={data.rules}
        placeOptions={data.placeOptions}
        firebase={data.firebase}
        push={data.push}
        storageBytes={data.storageBytes}
        visitStore={data.visitStore}
      />
      {tab === "places" && (
        <div className="mt-6">
          <ZoneColors zones={zones} />
        </div>
      )}
    </main>
  );
}

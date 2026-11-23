import { AdminBack } from "@/components/admin-back";
import { LockButton } from "../lock-button";
import { loadPlacesAdmin } from "@/lib/places/config";
import { usageSummary } from "@/lib/places/usage";
import { householdTz } from "@/lib/dates";
import { PlacesAdminForm, type PersonView } from "./places-admin";

export const dynamic = "force-dynamic";

function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${min % 60} min ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export default async function PlacesAdminPage() {
  const [data, usage] = await Promise.all([loadPlacesAdmin(), usageSummary()]);
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Places</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Home Assistant sends each phone&rsquo;s location here. Setup steps are in
            docs/places-home-assistant.md.
          </p>
        </div>
        <LockButton />
      </header>

      <PlacesAdminForm
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
      />
    </main>
  );
}

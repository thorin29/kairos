"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { SelectField } from "@/components/select-field";
import { DateField } from "@/components/date-field";
import {
  createPlacesTokenAction,
  deleteNotifyRuleAction,
  deletePlaceNameAction,
  deletePlacesHistoryAction,
  saveFirebaseAction,
  saveNotifyRuleAction,
  sendTestNotificationAction,
  setPlaceRadiusAction,
  savePlacesKeysAction,
  savePlacesPeopleAction,
} from "@/lib/actions/places";
import type { UsageSummary } from "@/lib/places/usage-types";

export type PersonView = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string;
  entityId: string;
  points: number;
  last: { when: string; accuracy: string | null; speed: string | null; battery: string | null } | null;
};

const card = "space-y-4 rounded-xl border border-hairline bg-surface px-4 py-4";
const label = "text-xs font-semibold uppercase tracking-widest text-muted";
const field =
  "h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";
const primary =
  "inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent shadow-sm transition-all hover:brightness-110 disabled:opacity-50";
const secondary =
  "inline-flex h-10 items-center rounded-full border border-hairline bg-surface px-4 text-sm font-medium hover:border-accent disabled:opacity-50";

type Msg = { ok: boolean; text: string } | null;

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p
      role="status"
      className={`rounded-lg border px-3 py-2 text-sm ${
        msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {msg.text}
    </p>
  );
}

function size(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function PlacesAdminForm(props: {
  people: PersonView[];
  mapKeySet: boolean;
  lookupKeySet: boolean;
  mapId: string;
  tokenMade: string | null;
  lastReceived: string | null;
  unlinked: { entityId: string; when: string } | null;
  totalPoints: number;
  storageBytes: number;
  usage: UsageSummary;
  named: { id: string; name: string | null; who: string | null; radiusM: number; createdAt: string }[];
  rules: { id: string; tell: string[]; about: string | null; place: string; onArrive: boolean; onLeave: boolean }[];
  placeOptions: { value: string; label: string }[];
  firebase: { projectId: string; applicationId: string; apiKey: string; senderId: string } | null;
  push: { firebase: boolean; devices: number; waiting: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Token
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const makeToken = () => {
    if (props.tokenMade && !confirm("Make a new token? The old one stops working until Home Assistant has the new one.")) return;
    startTransition(async () => {
      const res = await createPlacesTokenAction();
      setToken(res.token);
      setCopied(false);
      router.refresh();
    });
  };
  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // People
  const [entities, setEntities] = useState<Record<string, string>>(
    Object.fromEntries(props.people.map((p) => [p.id, p.entityId])),
  );
  const [peopleMsg, setPeopleMsg] = useState<Msg>(null);
  const savePeople = () =>
    startTransition(async () => {
      setPeopleMsg(null);
      const res = await savePlacesPeopleAction(
        props.people.map((p) => ({ userId: p.id, entityId: entities[p.id] ?? "" })),
      );
      setPeopleMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: "Saved." });
      if (!res.error) router.refresh();
    });

  // Keys
  const [mapKey, setMapKey] = useState("");
  const [lookupKey, setLookupKey] = useState("");
  const [clearMap, setClearMap] = useState(false);
  const [clearLookup, setClearLookup] = useState(false);
  const [mapId, setMapId] = useState(props.mapId);
  const [keysMsg, setKeysMsg] = useState<Msg>(null);
  const saveKeys = () =>
    startTransition(async () => {
      setKeysMsg(null);
      const res = await savePlacesKeysAction({ mapKey, lookupKey, mapId, clearMap, clearLookup });
      setKeysMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: "Saved." });
      setMapKey("");
      setLookupKey("");
      setClearMap(false);
      setClearLookup(false);
      router.refresh();
    });

  // Notifications
  const [tell, setTell] = useState<string[]>([]);
  const [about, setAbout] = useState("");
  const [place, setPlace] = useState("");
  const [onArrive, setOnArrive] = useState(true);
  const [onLeave, setOnLeave] = useState(false);
  const [ruleMsg, setRuleMsg] = useState<Msg>(null);
  const [testWho, setTestWho] = useState("");
  const addRule = () =>
    startTransition(async () => {
      setRuleMsg(null);
      const res = await saveNotifyRuleAction({ tellUserIds: tell, aboutUserId: about || null, place, onArrive, onLeave });
      if (res.error) setRuleMsg({ ok: false, text: res.error });
      else {
        setRuleMsg({ ok: true, text: "Added." });
        setTell([]);
        setAbout("");
        setPlace("");
        setOnArrive(true);
        setOnLeave(false);
        router.refresh();
      }
    });
  const test = () =>
    startTransition(async () => {
      if (!testWho) return;
      await sendTestNotificationAction(testWho);
      setRuleMsg({ ok: true, text: "Test queued." });
      router.refresh();
    });

  // Firebase
  const [fb, setFb] = useState({
    projectId: props.firebase?.projectId ?? "",
    applicationId: props.firebase?.applicationId ?? "",
    apiKey: props.firebase?.apiKey ?? "",
    senderId: props.firebase?.senderId ?? "",
  });
  const [saJson, setSaJson] = useState("");
  const [fbMsg, setFbMsg] = useState<Msg>(null);
  const saveFb = (clear = false) =>
    startTransition(async () => {
      setFbMsg(null);
      if (clear && !confirm("Remove the Firebase settings? Phones fall back to checking on their own schedule.")) return;
      const res = await saveFirebaseAction({ ...fb, serviceAccountJson: saJson, clear });
      setFbMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: clear ? "Removed." : "Saved." });
      if (!res.error) {
        setSaJson("");
        if (clear) setFb({ projectId: "", applicationId: "", apiKey: "", senderId: "" });
        router.refresh();
      }
    });

  // Delete history
  const [who, setWho] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [delMsg, setDelMsg] = useState<Msg>(null);
  const whoName = who ? props.people.find((p) => p.id === who)?.name ?? "this person" : "everyone";
  const range = from && to ? ` from ${from} to ${to}` : from ? ` from ${from} on` : to ? ` up to ${to}` : "";
  const del = () => {
    if (!confirm(`Delete location history for ${whoName}${range || ", all of it"}? This can't be undone.`)) return;
    startTransition(async () => {
      setDelMsg(null);
      const res = await deletePlacesHistoryAction({ userId: who || null, from: from || null, to: to || null });
      setDelMsg(
        res.error
          ? { ok: false, text: res.error }
          : { ok: true, text: `Deleted ${res.deleted.toLocaleString()} point${res.deleted === 1 ? "" : "s"}.` },
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className={label}>Status</h2>
        <p className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${props.lastReceived ? "bg-emerald-600" : "bg-hairline"}`}
          />
          {props.lastReceived ? `Last location received ${props.lastReceived}` : "Nothing received yet"}
        </p>
        {props.unlinked && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span className="font-mono">{props.unlinked.entityId}</span> sent a location ({props.unlinked.when})
            but isn&rsquo;t linked to anyone below.
          </p>
        )}
        <p className="text-sm text-muted">
          {props.totalPoints.toLocaleString()} point{props.totalPoints === 1 ? "" : "s"} stored · {size(props.storageBytes)}
        </p>
      </section>

      <section className={card}>
        <h2 className={label}>Google usage</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 pr-3 font-medium">Calls by Kairos</th>
                <th className="py-1 pr-3 text-right font-medium">Today</th>
                <th className="py-1 pr-3 text-right font-medium">This month</th>
                <th className="py-1 pr-3 text-right font-medium">Free / month</th>
                <th className="py-1 text-right font-medium">Kairos limit / day</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {(
                [
                  ["mapload", "Map loads"],
                  ["nearby", "Place names"],
                  ["geocode", "Addresses"],
                  ["roads", "Road tracks"],
                  ["routes", "Routes"],
                ] as const
              ).map(([k, name]) => {
                const u = props.usage[k];
                const high = u.month > u.free * 0.8;
                return (
                  <tr key={k} className="border-t border-hairline">
                    <td className="py-1.5 pr-3 font-sans">{name}</td>
                    <td className="py-1.5 pr-3 text-right">{u.today.toLocaleString()}</td>
                    <td className={`py-1.5 pr-3 text-right ${high ? "text-red-700" : ""}`}>{u.month.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-right">{u.free.toLocaleString()}</td>
                    <td className="py-1.5 text-right">{u.limit == null ? "—" : u.limit.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href="https://console.cloud.google.com/google/maps-apis/metrics" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
            Google usage ↗
          </a>
          <a href="https://console.cloud.google.com/google/maps-apis/quotas" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
            Daily caps ↗
          </a>
          <a href="https://console.cloud.google.com/billing" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
            Billing ↗
          </a>
        </p>
      </section>

      <section className={card}>
        <h2 className={label}>Home Assistant token</h2>
        {token ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={token}
                aria-label="New token"
                onFocus={(e) => e.currentTarget.select()}
                className={`${field} font-mono`}
              />
              <button type="button" onClick={copy} className={secondary}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-sm font-medium text-amber-800">Copy it now. It isn&rsquo;t shown again.</p>
          </div>
        ) : (
          <p className="text-sm">{props.tokenMade ? `Made ${props.tokenMade}` : "No token yet"}</p>
        )}
        <button type="button" onClick={makeToken} disabled={pending} className={props.tokenMade ? secondary : primary}>
          {props.tokenMade ? "New token" : "Make token"}
        </button>
      </section>

      <section className={card}>
        <h2 className={label}>People</h2>
        <ul className="space-y-4">
          {props.people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3">
              <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} avatarPosition={p.avatarPosition} size="sm" />
              <div className="min-w-0 flex-1 basis-56">
                <label htmlFor={`ent-${p.id}`} className="block text-sm font-medium">
                  {p.name}
                </label>
                <p className="text-xs text-muted">
                  {p.last
                    ? [p.last.when, p.last.accuracy, p.last.battery, p.last.speed].filter(Boolean).join(" · ")
                    : p.points > 0
                      ? `${p.points.toLocaleString()} points`
                      : "No locations yet"}
                </p>
              </div>
              <input
                id={`ent-${p.id}`}
                value={entities[p.id] ?? ""}
                onChange={(e) => setEntities({ ...entities, [p.id]: e.target.value })}
                placeholder="Not tracked"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className={`${field} basis-64 flex-1 font-mono`}
              />
            </li>
          ))}
        </ul>
        <button type="button" onClick={savePeople} disabled={pending} className={primary}>
          Save people
        </button>
        <Note msg={peopleMsg} />
      </section>

      <section className={card}>
        <h2 className={label}>Google Maps</h2>
        <div>
          <label htmlFor="places-map-key" className="mb-1 block text-sm font-medium">
            Map key {props.mapKeySet && <span className="font-normal text-muted">(set — blank keeps it)</span>}
          </label>
          <input
            id="places-map-key"
            type="password"
            value={mapKey}
            onChange={(e) => setMapKey(e.target.value)}
            autoComplete="new-password"
            placeholder={props.mapKeySet ? "••••••••" : "Maps JavaScript API key"}
            className={field}
          />
          {props.mapKeySet && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={clearMap} onChange={(e) => setClearMap(e.target.checked)} className="h-4 w-4" />
              Remove the saved key
            </label>
          )}
        </div>
        <div>
          <label htmlFor="places-map-id" className="mb-1 block text-sm font-medium">
            Map ID
          </label>
          <input
            id="places-map-id"
            value={mapId}
            onChange={(e) => setMapId(e.target.value)}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="From Google Maps Platform → Map management"
            className={`${field} font-mono`}
          />
        </div>
        <div>
          <label htmlFor="places-lookup-key" className="mb-1 block text-sm font-medium">
            Place lookup key{" "}
            {props.lookupKeySet && <span className="font-normal text-muted">(set — blank keeps it)</span>}
          </label>
          <input
            id="places-lookup-key"
            type="password"
            value={lookupKey}
            onChange={(e) => setLookupKey(e.target.value)}
            autoComplete="new-password"
            placeholder={props.lookupKeySet ? "••••••••" : "Places and Geocoding API key"}
            className={field}
          />
          {props.lookupKeySet && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clearLookup}
                onChange={(e) => setClearLookup(e.target.checked)}
                className="h-4 w-4"
              />
              Remove the saved key
            </label>
          )}
        </div>
        <button type="button" onClick={saveKeys} disabled={pending} className={primary}>
          Save keys
        </button>
        <Note msg={keysMsg} />
      </section>

      <section className={card}>
        <h2 className={label}>Notifications</h2>
        {props.rules.length === 0 ? (
          <p className="text-sm text-muted">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {props.rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {r.about ?? "Anyone"} · {[r.onArrive && "arrives at", r.onLeave && "leaves"].filter(Boolean).join(" / ")} {r.place}
                  </span>
                  <span className="block text-xs text-muted">Tell {r.tell.join(", ")}</span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteNotifyRuleAction(r.id);
                      router.refresh();
                    })
                  }
                  className="inline-flex h-9 items-center rounded-full border border-hairline px-3 text-xs font-medium hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 rounded-lg border border-hairline px-3 py-3">
          <div>
            <span className="mb-1 block text-sm font-medium">Tell</span>
            <div className="flex flex-wrap gap-2">
              {props.people.map((p) => {
                const on = tell.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTell(on ? tell.filter((x) => x !== p.id) : [...tell, p.id])}
                    className={on ? `${primary} h-9 px-3` : `${secondary} h-9 px-3`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              value={about}
              onChange={setAbout}
              ariaLabel="About"
              placeholder="About anyone"
              options={[{ value: "", label: "About anyone" }, ...props.people.filter((p) => p.entityId).map((p) => ({ value: p.id, label: `About ${p.name}` }))]}
            />
            <SelectField
              value={place}
              onChange={setPlace}
              ariaLabel="Place"
              placeholder={props.placeOptions.length ? "Place" : "No places yet"}
              options={props.placeOptions}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" checked={onArrive} onChange={(e) => setOnArrive(e.target.checked)} className="h-4 w-4" />
              Arrives
            </label>
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" checked={onLeave} onChange={(e) => setOnLeave(e.target.checked)} className="h-4 w-4" />
              Leaves
            </label>
          </div>
          <button type="button" onClick={addRule} disabled={pending} className={primary}>
            Add notification
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <SelectField
              value={testWho}
              onChange={setTestWho}
              ariaLabel="Send a test to"
              placeholder="Send a test to…"
              options={props.people.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <button type="button" onClick={test} disabled={pending || !testWho} className={secondary}>
            Send test
          </button>
        </div>
        <p className="text-sm text-muted">
          {props.push.waiting > 0 ? `${props.push.waiting} waiting for the app · ` : ""}
          {props.push.firebase ? `Instant push on · ${props.push.devices} phone${props.push.devices === 1 ? "" : "s"} registered` : "Instant push off"}
        </p>
        <Note msg={ruleMsg} />
      </section>

      <section className={card}>
        <h2 className={label}>Instant push (Firebase)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["projectId", "Project ID"],
              ["senderId", "Sender ID (project number)"],
              ["applicationId", "App ID"],
              ["apiKey", "API key"],
            ] as const
          ).map(([k, name]) => (
            <div key={k}>
              <label htmlFor={`fb-${k}`} className="mb-1 block text-sm font-medium">
                {name}
              </label>
              <input
                id={`fb-${k}`}
                value={fb[k]}
                onChange={(e) => setFb({ ...fb, [k]: e.target.value })}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className={`${field} font-mono`}
              />
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="fb-sa" className="mb-1 block text-sm font-medium">
            Service account key {props.push.firebase && <span className="font-normal text-muted">(set — blank keeps it)</span>}
          </label>
          <textarea
            id="fb-sa"
            value={saJson}
            onChange={(e) => setSaJson(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder={props.push.firebase ? "••••••••" : "Paste the whole JSON file"}
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => saveFb(false)} disabled={pending} className={primary}>
            Save
          </button>
          {props.firebase && (
            <button type="button" onClick={() => saveFb(true)} disabled={pending} className={secondary}>
              Remove
            </button>
          )}
        </div>
        <Note msg={fbMsg} />
      </section>

      <section className={card}>
        <h2 className={label}>Named places</h2>
        {props.named.length === 0 ? (
          <p className="text-sm text-muted">None yet. Use “Not right?” on a person in Places.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {props.named.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{n.name ?? "Just the address"}</span>
                  <span className="block text-xs text-muted">{n.who ? `Only ${n.who}` : "Everyone"}</span>
                </span>
                <select
                  aria-label="Size"
                  value={n.radiusM}
                  disabled={pending}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    startTransition(async () => {
                      await setPlaceRadiusAction(n.id, r);
                      router.refresh();
                    });
                  }}
                  className="h-9 rounded-lg border border-hairline bg-surface px-2 text-xs"
                >
                  {[50, 100, 150, 250, 500].map((r) => (
                    <option key={r} value={r}>
                      {r} m
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Remove “${n.name ?? "Just the address"}”?`)) return;
                    startTransition(async () => {
                      await deletePlaceNameAction(n.id);
                      router.refresh();
                    });
                  }}
                  className="inline-flex h-9 items-center rounded-full border border-hairline px-3 text-xs font-medium hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className={label}>Delete history</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            value={who}
            onChange={setWho}
            ariaLabel="Whose history"
            placeholder="Everyone"
            options={[{ value: "", label: "Everyone" }, ...props.people.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <DateField value={from} onChange={setFrom} ariaLabel="From" placeholder="From (any)" max={to || undefined} className={`tabular ${field}`} />
          <DateField value={to} onChange={setTo} ariaLabel="To" placeholder="To (any)" min={from || undefined} className={`tabular ${field}`} />
        </div>
        <button
          type="button"
          onClick={del}
          disabled={pending || props.totalPoints === 0}
          className="inline-flex h-10 items-center rounded-full border border-red-300 bg-surface px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
        <Note msg={delMsg} />
      </section>
    </div>
  );
}

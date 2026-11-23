"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { SelectField } from "@/components/select-field";
import { DateField } from "@/components/date-field";
import {
  createPlacesTokenAction,
  deletePlacesHistoryAction,
  savePlacesKeysAction,
  savePlacesPeopleAction,
} from "@/lib/actions/places";

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

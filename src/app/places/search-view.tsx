"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import type { PlaceChoice } from "@/lib/places/naming-types";
import type { PlacesList, PlacesListRow, PlaceVisitRow } from "@/lib/places/visits-types";
import { changePlaceNow, dayHref, placesHref, placesListNow, useEmbed, visitsNow } from "./embed-context";
import { PlaceFix } from "./place-fix";

/**
 * Places (v0.795): search where the family has been, and the list of every
 * place to confirm or tidy. Reads Kairos's own visit records only — nothing
 * here asks Google, except picking a business name while confirming.
 */

type Person = { id: string; name: string; color: string; avatarPath: string | null; avatarPosition: string };
type Size = "small" | "normal" | "large";
type Range = "30" | "365" | "all";

const chip = (on: boolean) =>
  `inline-flex h-8 items-center whitespace-nowrap rounded-[10px] border px-2.5 text-xs font-semibold ${
    on ? "border-ink bg-ink text-white" : "border-hairline bg-surface text-ink hover:border-accent"
  }`;
const card = "overflow-hidden rounded-2xl border border-hairline bg-surface";

function sinceFor(range: Range, today: string): string | null {
  if (range === "all") return null;
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - Number(range) * 86_400_000);
  return t.toISOString().slice(0, 10);
}

function dayLabel(iso: string, thisYear: number): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== thisYear ? { year: "numeric" } : {}),
  });
}
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function length(a: string, b: string): string {
  const min = Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
/** The day a visit belongs to, for its history link. */
function isoDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function KindSize({
  kind,
  size,
  onKind,
  onSize,
}: {
  kind: string | null;
  size: Size;
  onKind: (k: string | null) => void;
  onSize: (s: Size) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 text-xs text-muted">Type</span>
        {[
          ["business", "Business"],
          ["home", "Someone's home"],
        ].map(([k, l]) => (
          <button key={k} type="button" className={chip(kind === k)} onClick={() => onKind(kind === k ? null : k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 text-xs text-muted">Size</span>
        {(["small", "normal", "large"] as Size[]).map((s) => (
          <button key={s} type="button" className={chip(size === s)} onClick={() => onSize(s)}>
            {s === "small" ? "Small" : s === "normal" ? "Normal" : "Large"}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">Small keeps neighbouring shops apart; Large covers a big store or campus.</p>
    </div>
  );
}

export function PlacesSearch({ people, today, canEdit }: { people: Person[]; today: string; canEdit: boolean }) {
  const embed = useEmbed();
  const thisYear = Number(today.slice(0, 4));
  const [view, setView] = useState<"search" | "all">("search");
  const [q, setQ] = useState("");
  const [who, setWho] = useState<string[]>([]);
  const [range, setRange] = useState<Range>("365");
  const [place, setPlace] = useState<{ key: string; name: string } | null>(null);
  const [visits, setVisits] = useState<PlaceVisitRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<PlacesList | null>(null);
  const [reload, setReload] = useState(0);
  const [moving, setMoving] = useState<PlaceVisitRow | null>(null);
  const seq = useRef(0);

  const since = sinceFor(range, today);
  const load = useCallback(
    async (offset: number) => {
      const mine = ++seq.current;
      try {
        const res = await visitsNow({ q, users: who, since, place: place?.key ?? null, offset });
        if (mine !== seq.current) return;
        setVisits((cur) => (offset > 0 && cur ? [...cur, ...res.visits] : res.visits));
        setTotal(res.total);
        setMore(res.more);
        setError(null);
      } catch {
        if (mine === seq.current) setError("Couldn't search. Try again.");
      }
    },
    [q, who, since, place],
  );

  useEffect(() => {
    if (view !== "search") return;
    const t = setTimeout(() => void load(0), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, view, q, reload]);

  useEffect(() => {
    placesListNow()
      .then(setList)
      .catch(() => setList(null));
  }, [reload]);

  const toggleWho = (id: string) => setWho((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const refresh = () => setReload((n) => n + 1);

  return (
    <main className={embed ? "flex h-[100dvh] flex-col px-3 py-3" : "mx-auto max-w-3xl px-4 py-6"}>
      <div className="mb-3 flex items-center gap-2">
        {view === "all" ? (
          <button
            type="button"
            onClick={() => setView("search")}
            aria-label="Back to search"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-xl hover:border-accent"
          >
            ‹
          </button>
        ) : (
          <Link
            href={placesHref(embed)}
            aria-label="Back to Family map"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-xl hover:border-accent"
          >
            ‹
          </Link>
        )}
        <h1 className="font-display text-xl font-semibold tracking-tight">{view === "all" ? "All places" : "Places"}</h1>
      </div>

      <div className={embed ? "min-h-0 flex-1 overflow-y-auto pb-4" : ""}>
        {view === "search" ? (
          <div className="space-y-2.5">
            {/* All places first (v0.797.1): where places get confirmed. */}
            <button
              type="button"
              onClick={() => setView("all")}
              className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-surface px-4 py-3 text-left hover:border-accent"
            >
              <span>
                <span className="block text-sm font-semibold">All places</span>
                <span className="block text-xs text-muted">
                  {list ? `${list.rows.length} places · ${list.toConfirm} to confirm` : "Every place anyone stopped at"}
                </span>
              </span>
              {list && list.toConfirm > 0 && (
                <span className="rounded-lg bg-amber-700 px-2 py-0.5 text-xs font-semibold text-white">{list.toConfirm}</span>
              )}
            </button>
            <div className="flex h-11 items-center gap-2 rounded-[10px] border-[1.5px] border-ink bg-surface px-3">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={80}
                enterKeyHint="search"
                placeholder="A place, a name you gave it, or a street"
                aria-label="Search places"
                className="min-w-0 flex-1 bg-transparent text-base outline-none"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Clear" className="text-muted hover:text-ink">
                  ✕
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={chip(who.length === 0)} onClick={() => setWho([])}>
                Everyone
              </button>
              {people.map((p) => (
                <button key={p.id} type="button" className={chip(who.includes(p.id))} onClick={() => toggleWho(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["30", "30 days"],
                  ["365", "1 year"],
                  ["all", "All"],
                ] as [Range, string][]
              ).map(([r, l]) => (
                <button key={r} type="button" className={chip(range === r)} onClick={() => setRange(r)}>
                  {l}
                </button>
              ))}
              {place && (
                <button type="button" className={chip(true)} onClick={() => setPlace(null)} aria-label={`Showing ${place.name}; clear`}>
                  {place.name} ✕
                </button>
              )}
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}
            <p className="px-0.5 text-xs text-muted">
              {visits == null ? "Searching…" : `${total.toLocaleString()} visit${total === 1 ? "" : "s"}${q || place ? "" : ", newest first"}`}
            </p>

            {visits && visits.length > 0 && (
              <div className={card}>
                {visits.map((v, i) => (
                  <VisitRow
                    key={v.id}
                    v={v}
                    first={i === 0}
                    thisYear={thisYear}
                    canEdit={canEdit}
                    onChoose={async (placeNameId) => {
                      const res = await changePlaceNow({ op: "choose", visitId: v.id, placeNameId });
                      if (res.error) setError(res.error);
                      else refresh();
                    }}
                    onMove={() => setMoving(v)}
                  />
                ))}
                {more && (
                  <button
                    type="button"
                    onClick={() => void load(visits.length)}
                    className="w-full border-t border-hairline py-2.5 text-center text-sm text-muted hover:text-ink"
                  >
                    Show more
                  </button>
                )}
              </div>
            )}
            {visits && visits.length === 0 && <p className="px-0.5 py-3 text-sm text-muted">No visits found.</p>}

          </div>
        ) : (
          <AllPlaces
            list={list}
            thisYear={thisYear}
            canEdit={canEdit}
            people={people}
            onChanged={refresh}
            onShowVisits={(r) => {
              setPlace({ key: r.key, name: r.name || "This place" });
              setQ("");
              setView("search");
            }}
          />
        )}
      </div>

      {moving && (
        <PlaceFix
          personId={moving.person.id}
          personName={moving.person.name}
          spot={{ lat: moving.lat, lng: moving.lng, accuracyM: 30 }}
          current={moving.place}
          title={`Where was ${moving.person.name}?`}
          noNone
          onPick={async (c: PlaceChoice | null) => {
            if (!c) return "Pick a place.";
            const res = await changePlaceNow({
              op: "move",
              visitId: moving.id,
              name: c.name,
              address: c.address,
              placeId: c.placeId,
              lat: c.lat,
              lng: c.lng,
            });
            if (!res.error) refresh();
            return res.error;
          }}
          onClose={() => setMoving(null)}
          onSaved={refresh}
        />
      )}
    </main>
  );
}

function VisitRow({
  v,
  first,
  thisYear,
  canEdit,
  onChoose,
  onMove,
}: {
  v: PlaceVisitRow;
  first: boolean;
  thisYear: number;
  canEdit: boolean;
  onChoose: (placeNameId: string) => void;
  onMove: () => void;
}) {
  const embed = useEmbed();
  return (
    <div className={first ? "" : "border-t border-hairline"}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar name={v.person.name} color={v.person.color} avatarPath={v.person.avatarPath} avatarPosition={v.person.avatarPosition} size="sm" />
        <Link href={dayHref(embed, v.person.id, isoDay(v.arrivedAt), v.arrivedAt)} className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {dayLabel(v.arrivedAt, thisYear)} · {v.person.name}
          </span>
          <span className="block truncate text-xs text-muted">
            {time(v.arrivedAt)} – {time(v.leftAt)} · {length(v.arrivedAt, v.leftAt)} · {v.place ?? v.address ?? "Unnamed spot"}
            {v.place && v.address ? `, ${v.address}` : ""}
          </span>
        </Link>
        {canEdit && !v.choices && (
          <button
            type="button"
            onClick={onMove}
            aria-label="Change place"
            title="Change place"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-ground hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
            </svg>
          </button>
        )}
      </div>
      {v.choices && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5 pl-[3.6rem]">
          <span className="text-xs font-semibold text-amber-800">Which one?</span>
          {v.choices.map((c) => (
            <button key={c.id} type="button" disabled={!canEdit} className={chip(false)} onClick={() => onChoose(c.id)}>
              {c.name ?? "Unnamed"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Filter = "todo" | "done" | "all";
type Sort = "last" | "most" | "az";

function AllPlaces({
  list,
  thisYear,
  canEdit,
  people,
  onChanged,
  onShowVisits,
}: {
  list: PlacesList | null;
  thisYear: number;
  canEdit: boolean;
  people: Person[];
  onChanged: () => void;
  onShowVisits: (r: PlacesListRow) => void;
}) {
  const [filter, setFilter] = useState<Filter>(list && list.toConfirm > 0 ? "todo" : "all");
  const [sort, setSort] = useState<Sort>("last");
  const [open, setOpen] = useState<PlacesListRow | null>(null);

  const rows = useMemo(() => {
    if (!list) return [];
    const r = list.rows.filter((x) => (filter === "all" ? true : filter === "todo" ? !x.confirmed : x.confirmed));
    return r.sort((a, b) =>
      sort === "az"
        ? (a.name || "~").localeCompare(b.name || "~")
        : sort === "most"
          ? b.visits - a.visits
          : (b.last ?? "").localeCompare(a.last ?? ""),
    );
  }, [list, filter, sort]);

  if (!list) return <p className="py-3 text-sm text-muted">Loading places…</p>;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(filter === "todo")} onClick={() => setFilter("todo")}>
          To confirm ({list.toConfirm})
        </button>
        <button type="button" className={chip(filter === "done")} onClick={() => setFilter("done")}>
          Confirmed
        </button>
        <button type="button" className={chip(filter === "all")} onClick={() => setFilter("all")}>
          All
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted">Sort</span>
        {(
          [
            ["last", "Last visit"],
            ["most", "Most visits"],
            ["az", "A–Z"],
          ] as [Sort, string][]
        ).map(([s, l]) => (
          <button key={s} type="button" className={chip(sort === s)} onClick={() => setSort(s)}>
            {l}
          </button>
        ))}
      </div>
      {list.whichOne > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {list.whichOne} visit{list.whichOne === 1 ? "" : "s"} could be either of two places. Search to find them under “Which one?”.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="py-3 text-sm text-muted">{filter === "todo" ? "Nothing to confirm." : "No places yet."}</p>
      ) : (
        <div className={card}>
          {rows.map((r, i) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setOpen(r)}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-ground ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.name || r.address || "Unnamed spot"}</span>
                {r.name && r.address && <span className="block truncate text-xs text-muted">{r.address}</span>}
                <span className="block text-xs text-muted">
                  {r.visits} visit{r.visits === 1 ? "" : "s"}
                  {r.last ? ` · last ${dayLabel(r.last, thisYear)}` : ""}
                </span>
              </span>
              {r.confirmed ? (
                <span className="shrink-0 text-xs text-muted">{r.kind}</span>
              ) : (
                <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.7rem] font-semibold text-amber-800">Confirm</span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && (
        <PlaceSheet
          row={open}
          canEdit={canEdit}
          people={people}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            onChanged();
          }}
          onShowVisits={() => {
            setOpen(null);
            onShowVisits(open);
          }}
        />
      )}
    </div>
  );
}

function PlaceSheet({
  row,
  canEdit,
  people,
  onClose,
  onChanged,
  onShowVisits,
}: {
  row: PlacesListRow;
  canEdit: boolean;
  people: Person[];
  onClose: () => void;
  onChanged: () => void;
  onShowVisits: () => void;
}) {
  const [kind, setKind] = useState<string | null>(row.kind === "Home" ? "home" : row.kind === "Business" ? "business" : null);
  const [size, setSize] = useState<Size>(row.radiusM != null && row.radiusM <= 60 ? "small" : row.radiusM != null && row.radiusM >= 250 ? "large" : "normal");
  const [name, setName] = useState(row.name);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSpot = row.key.startsWith("spot:");
  const isName = row.key.startsWith("name:");
  const id = row.key.slice(5);

  const run = async (f: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setError(null);
    const res = await f();
    setBusy(false);
    if (res.error) setError(res.error);
    else onChanged();
  };

  if (picking && row.lat != null && row.lng != null) {
    return (
      <PlaceFix
        personId={people[0]?.id ?? ""}
        personName=""
        spot={{ lat: row.lat, lng: row.lng, accuracyM: 30 }}
        current={row.name || null}
        title="What is this place?"
        everyoneOnly
        extra={{ kind, size }}
        controls={<KindSize kind={kind} size={size} onKind={setKind} onSize={setSize} />}
        onClose={() => setPicking(false)}
        onSaved={onChanged}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={row.name || "Place"}
        className="w-full max-w-md space-y-3 rounded-2xl bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{row.name || row.address || "Unnamed spot"}</h2>
            {row.name && row.address && <p className="truncate text-sm text-muted">{row.address}</p>}
            <p className="text-xs text-muted">
              {row.visits} visit{row.visits === 1 ? "" : "s"}
              {row.confirmed ? ` · ${row.kind}` : " · not confirmed"}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground">
            ✕
          </button>
        </div>

        {isSpot && (
          <>
            <KindSize kind={kind} size={size} onKind={setKind} onSize={setSize} />
            {row.name ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => changePlaceNow({ op: "confirm", spotId: id, kind, size }))}
                className="flex h-11 w-full items-center justify-center rounded-[10px] bg-ink text-sm font-semibold text-white disabled:opacity-50"
              >
                That&rsquo;s right: {row.name}
              </button>
            ) : (
              <p className="text-xs text-muted">Google&rsquo;s name for this spot has expired or was never looked up. Pick or type one.</p>
            )}
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex h-11 w-full items-center justify-center rounded-[10px] border border-hairline text-sm font-semibold hover:border-accent"
            >
              {row.name ? "Not right? Pick or type a name" : "Pick or type a name"}
            </button>
          </>
        )}

        {isName && canEdit && (
          <>
            <label className="block">
              <span className="text-xs text-muted">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="mt-1 h-11 w-full rounded-[10px] border border-hairline bg-surface px-3 text-base outline-none focus:border-accent"
              />
            </label>
            <KindSize kind={kind} size={size} onKind={setKind} onSize={setSize} />
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => changePlaceNow({ op: "update", placeNameId: id, name, kind, size }))}
              className="flex h-11 w-full items-center justify-center rounded-[10px] bg-ink text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
          </>
        )}

        {row.visits > 0 && (
          <button type="button" onClick={onShowVisits} className="w-full py-1 text-center text-sm font-medium text-accent hover:underline">
            See its visits
          </button>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}

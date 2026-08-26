"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import {
  CartIcon,
  GripIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  addFromCatalog,
  addItem,
  removeItem,
  saveOrder,
  startTrip,
} from "@/lib/actions/groceries";
import type {
  CatalogSuggestion,
  Person,
  ShoppingItemView,
  StoreView,
  TripView,
} from "@/lib/queries/groceries";

type Pending = {
  label: string;
  catalogId?: string;
  defaultStoreId?: string | null;
};

export function GroceryBoard({
  stores,
  saved,
  trips,
  catalog,
  roster,
  meId,
}: {
  stores: StoreView[];
  saved: ShoppingItemView[];
  trips: TripView[];
  catalog: CatalogSuggestion[];
  roster: Person[];
  meId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const tripByStore = useMemo(
    () => new Map(trips.map((t) => [t.storeId, t])),
    [trips],
  );

  // Per-store saved lists, held locally so a drag moves items live; re-synced
  // whenever the server sends fresh data.
  const [lists, setLists] = useState<Map<string, ShoppingItemView[]>>(new Map());
  useEffect(() => {
    const m = new Map<string, ShoppingItemView[]>();
    for (const s of stores) m.set(s.id, []);
    for (const i of saved) {
      const arr = m.get(i.storeId);
      if (arr) arr.push(i);
      else m.set(i.storeId, [i]);
    }
    setLists(m);
  }, [saved, stores]);

  const dragId = useRef<string | null>(null);
  const touched = useRef<Set<string>>(new Set());

  const findItem = (id: string): ShoppingItemView | null => {
    for (const arr of lists.values()) {
      const hit = arr.find((i) => i.id === id);
      if (hit) return hit;
    }
    return null;
  };

  // Move the dragged item into targetStore at index, live.
  const moveTo = (targetStore: string, index: number) => {
    const id = dragId.current;
    if (!id) return;
    setLists((prev) => {
      const next = new Map(prev);
      let moved: ShoppingItemView | null = null;
      let sourceStore: string | null = null;
      for (const [sid, arr] of next) {
        const at = arr.findIndex((i) => i.id === id);
        if (at !== -1) {
          moved = arr[at];
          sourceStore = sid;
          const copy = arr.slice();
          copy.splice(at, 1);
          next.set(sid, copy);
          break;
        }
      }
      if (!moved) return prev;
      const dest = (next.get(targetStore) ?? []).slice();
      const clampedItem = { ...moved, storeId: targetStore };
      const clamped = Math.max(0, Math.min(index, dest.length));
      dest.splice(clamped, 0, clampedItem);
      next.set(targetStore, dest);
      if (sourceStore) touched.current.add(sourceStore);
      touched.current.add(targetStore);
      return next;
    });
  };

  const endDrag = () => {
    const changed = [...touched.current];
    dragId.current = null;
    touched.current = new Set();
    if (changed.length === 0) return;
    const groups = changed.map((storeId) => ({
      storeId,
      itemIds: (lists.get(storeId) ?? []).map((i) => i.id),
    }));
    startTransition(() => saveOrder(groups));
  };

  // Add flow
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const [pick, setPick] = useState<Pending | null>(null);
  const [who, setWho] = useState<string | null>(null);

  const q = name.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [catalog, q]);
  const exact = catalog.some((c) => c.name.toLowerCase() === q);
  const common = useMemo(() => catalog.slice(0, 12), [catalog]);
  const only = stores.length === 1 ? stores[0].id : null;

  const commit = (p: Pending) => {
    setName("");
    setFocused(false);
    if (only) {
      if (p.catalogId) startTransition(() => addFromCatalog(p.catalogId!, only));
      else startTransition(() => addItem({ name: p.label, storeId: only }));
      return;
    }
    setPick(p);
  };
  const chooseStore = (storeId: string) => {
    if (!pick) return;
    if (pick.catalogId) startTransition(() => addFromCatalog(pick.catalogId!, storeId));
    else startTransition(() => addItem({ name: pick.label, storeId }));
    setPick(null);
  };
  const submitTyped = () => {
    const label = name.trim();
    if (!label) return;
    const hit = catalog.find((c) => c.name.toLowerCase() === label.toLowerCase());
    commit(
      hit
        ? { label: hit.name, catalogId: hit.id, defaultStoreId: hit.defaultStoreId }
        : { label },
    );
  };

  const beginTrip = (shopperId: string) => {
    if (!who) return;
    const storeId = who;
    setWho(null);
    startTransition(async () => {
      const res = await startTrip(storeId, shopperId);
      if (res.ok && meId && shopperId === meId) {
        router.push(`/groceries/shop/${storeId}`);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Add bar */}
      <div className="rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 120)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches.length && !exact)
                    commit({
                      label: matches[0].name,
                      catalogId: matches[0].id,
                      defaultStoreId: matches[0].defaultStoreId,
                    });
                  else submitTyped();
                }
              }}
              placeholder="Add an item…"
              className="h-11 w-full rounded-full border border-hairline bg-ground/40 px-5 outline-none focus:border-accent"
            />
            {focused && q.length > 0 && (
              <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-lg">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      commit({
                        label: c.name,
                        catalogId: c.id,
                        defaultStoreId: c.defaultStoreId,
                      })
                    }
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-ink/5"
                  >
                    <span className="text-lg" aria-hidden>
                      {c.icon}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <PlusIcon className="h-4 w-4 text-muted" />
                  </button>
                ))}
                {!exact && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitTyped}
                    className="flex w-full items-center gap-2.5 border-t border-hairline px-4 py-2.5 text-left text-sm text-accent hover:bg-accent/5"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span className="truncate">Add “{name.trim()}”</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={submitTyped}
            disabled={pending || !name.trim()}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>

        {q.length === 0 && common.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted">
              Common
            </p>
            <div className="flex flex-wrap gap-1.5">
              {common.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    commit({
                      label: c.name,
                      catalogId: c.id,
                      defaultStoreId: c.defaultStoreId,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  <span aria-hidden>{c.icon}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Per-store */}
      <div className="space-y-4">
        {stores.map((s) => {
          const trip = tripByStore.get(s.id);
          if (trip) return <TripStatus key={s.id} store={s} trip={trip} />;
          return (
            <SavedStore
              key={s.id}
              store={s}
              items={lists.get(s.id) ?? []}
              onShop={() => setWho(s.id)}
              onRemove={(id) => {
                setLists((prev) => {
                  const next = new Map(prev);
                  next.set(
                    s.id,
                    (next.get(s.id) ?? []).filter((i) => i.id !== id),
                  );
                  return next;
                });
                startTransition(() => removeItem(id));
              }}
              onDragStartItem={(id) => {
                dragId.current = id;
              }}
              onDragOverItem={(index) => moveTo(s.id, index)}
              onDragOverCard={() => {
                const cur = lists.get(s.id) ?? [];
                if (dragId.current && !cur.some((i) => i.id === dragId.current)) {
                  moveTo(s.id, cur.length);
                }
              }}
              onDragEnd={endDrag}
              dragging={dragId.current}
            />
          );
        })}
      </div>

      {pick && (
        <StorePicker
          label={pick.label}
          stores={stores}
          usualStoreId={pick.defaultStoreId ?? null}
          onChoose={chooseStore}
          onClose={() => setPick(null)}
        />
      )}
      {who && (
        <WhoPicker
          storeName={stores.find((s) => s.id === who)?.name ?? ""}
          roster={roster}
          meId={meId}
          onChoose={beginTrip}
          onClose={() => setWho(null)}
        />
      )}
    </div>
  );
}

/* --------------------------- store: saved list --------------------------- */

function SavedStore({
  store,
  items,
  onShop,
  onRemove,
  onDragStartItem,
  onDragOverItem,
  onDragOverCard,
  onDragEnd,
  dragging,
}: {
  store: StoreView;
  items: ShoppingItemView[];
  onShop: () => void;
  onRemove: (id: string) => void;
  onDragStartItem: (id: string) => void;
  onDragOverItem: (index: number) => void;
  onDragOverCard: () => void;
  onDragEnd: () => void;
  dragging: string | null;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-hairline bg-surface"
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverCard();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
    >
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <span className="text-2xl" aria-hidden>
          {store.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold leading-tight">
            {store.name}
          </p>
          <p className="tabular text-xs text-muted">
            {items.length === 0
              ? "Nothing needed"
              : `${items.length} item${items.length === 1 ? "" : "s"} to get`}
          </p>
        </div>
        <button
          type="button"
          onClick={onShop}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
        >
          <CartIcon className="h-4 w-4" />
          Shop
        </button>
      </div>

      {items.length > 0 && (
        <div className="divide-y divide-hairline">
          {items.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => onDragStartItem(item.id)}
              onDragOver={(e) => {
                e.preventDefault();
                onDragOverItem(index);
              }}
              onDragEnd={onDragEnd}
              className={[
                "flex items-center gap-2 px-3 py-2.5",
                dragging === item.id ? "opacity-50" : "",
              ].join(" ")}
            >
              <span
                className="shrink-0 cursor-grab touch-none text-muted"
                title="Drag to reorder or move to another store"
              >
                <GripIcon className="h-4 w-4" />
              </span>
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {item.note && (
                  <p className="truncate text-xs text-muted">{item.note}</p>
                )}
              </div>
              {item.assignee && (
                <Avatar
                  name={item.assignee.name}
                  color={item.assignee.color}
                  avatarPath={item.assignee.avatarPath}
                  avatarPosition={item.assignee.avatarPosition}
                  size="sm"
                />
              )}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label="Remove"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-red-700"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------- store: someone shopping ---------------------- */

function TripStatus({ store, trip }: { store: StoreView; trip: TripView }) {
  const pct = trip.total === 0 ? 0 : Math.round((trip.got / trip.total) * 100);
  return (
    <Link
      href={`/groceries/shop/${store.id}`}
      className="block overflow-hidden rounded-2xl border border-hairline bg-surface transition-colors hover:border-accent"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-2xl" aria-hidden>
          {store.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold leading-tight">
            {store.name}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <CartIcon className="h-3.5 w-3.5" />
            {trip.shopper.name} is shopping
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular text-sm font-medium text-muted">
            {trip.got}/{trip.total}
          </span>
          <Avatar
            name={trip.shopper.name}
            color={trip.shopper.color}
            avatarPath={trip.shopper.avatarPath}
            avatarPosition={trip.shopper.avatarPosition}
            size="sm"
          />
        </div>
      </div>
      {trip.total > 0 && (
        <div className="h-1.5 bg-ground/60">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </Link>
  );
}

/* ------------------------------- modals ------------------------------- */

function StorePicker({
  label,
  stores,
  usualStoreId,
  onChoose,
  onClose,
}: {
  label: string;
  stores: StoreView[];
  usualStoreId: string | null;
  onChoose: (storeId: string) => void;
  onClose: () => void;
}) {
  const ordered = useMemo(() => {
    if (!usualStoreId) return stores;
    const usual = stores.filter((s) => s.id === usualStoreId);
    const rest = stores.filter((s) => s.id !== usualStoreId);
    return [...usual, ...rest];
  }, [stores, usualStoreId]);

  return (
    <Overlay onClose={onClose}>
      <p className="text-sm text-muted">Which store for</p>
      <p className="mb-4 truncate font-display text-xl font-semibold">{label}?</p>
      <div className="space-y-2">
        {ordered.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChoose(s.id)}
            className="flex w-full items-center gap-3 rounded-2xl border border-hairline px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/5"
          >
            <span className="text-2xl" aria-hidden>
              {s.icon}
            </span>
            <span className="flex-1 truncate text-base font-medium">{s.name}</span>
            {s.id === usualStoreId && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                usual
              </span>
            )}
          </button>
        ))}
      </div>
      <CancelRow onClose={onClose} />
    </Overlay>
  );
}

function WhoPicker({
  storeName,
  roster,
  meId,
  onChoose,
  onClose,
}: {
  storeName: string;
  roster: Person[];
  meId: string | null;
  onChoose: (shopperId: string) => void;
  onClose: () => void;
}) {
  const ordered = useMemo(() => {
    if (!meId) return roster;
    const me = roster.filter((p) => p.id === meId);
    const rest = roster.filter((p) => p.id !== meId);
    return [...me, ...rest];
  }, [roster, meId]);

  return (
    <Overlay onClose={onClose}>
      <p className="text-sm text-muted">Who’s shopping</p>
      <p className="mb-4 truncate font-display text-xl font-semibold">{storeName}?</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {ordered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChoose(p.id)}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-hairline p-3 transition-colors hover:border-accent hover:bg-accent/5"
          >
            <Avatar
              name={p.name}
              color={p.color}
              avatarPath={p.avatarPath}
              avatarPosition={p.avatarPosition}
              size="md"
            />
            <span className="w-full truncate text-center text-xs font-medium">
              {p.id === meId ? "Me" : p.name}
            </span>
          </button>
        ))}
      </div>
      <CancelRow onClose={onClose} />
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-hairline bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function CancelRow({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="mt-4 h-10 w-full rounded-full text-sm font-medium text-muted hover:bg-ink/5"
    >
      Cancel
    </button>
  );
}

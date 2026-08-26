"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import {
  ArrowLeftIcon,
  CartIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  addFromCatalog,
  addItem,
  assignItem,
  removeItem,
  restoreItem,
} from "@/lib/actions/groceries";
import type {
  CatalogSuggestion,
  ShoppingItemView,
  StoreView,
} from "@/lib/queries/groceries";

type Person = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
};

type BasketEntry = {
  key: number;
  name: string;
  icon: string;
  storeId: string;
  assignedToId: string | null;
  note: string | null;
};

export function GroceryBoard({
  stores,
  items,
  catalog,
  roster,
}: {
  stores: StoreView[];
  items: ShoppingItemView[];
  catalog: CatalogSuggestion[];
  roster: Person[];
}) {
  // Two modes share this page: planning the list, and shopping one store.
  const [shopId, setShopId] = useState<string | null>(null);

  // Optimistically hide a line the instant it's checked/removed, so the UI
  // doesn't wait on the round-trip before it disappears.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  // What was checked off this trip, newest first, for the undo strip.
  const [basket, setBasket] = useState<BasketEntry[]>([]);
  const basketKey = useRef(1);

  const [pending, startTransition] = useTransition();

  const storeById = useMemo(
    () => new Map(stores.map((s) => [s.id, s])),
    [stores],
  );

  const live = useMemo(
    () => items.filter((i) => !removed.has(i.id)),
    [items, removed],
  );

  const hide = (id: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const checkOff = (item: ShoppingItemView) => {
    hide(item.id);
    setBasket((b) => [
      {
        key: basketKey.current++,
        name: item.name,
        icon: item.icon,
        storeId: item.storeId,
        assignedToId: item.assignee?.id ?? null,
        note: item.note,
      },
      ...b,
    ]);
    startTransition(() => removeItem(item.id));
  };

  const undo = (entry: BasketEntry) => {
    setBasket((b) => b.filter((e) => e.key !== entry.key));
    startTransition(() =>
      restoreItem({
        name: entry.name,
        icon: entry.icon,
        storeId: entry.storeId,
        assignedToId: entry.assignedToId,
        note: entry.note,
      }),
    );
  };

  const dropFromList = (id: string) => {
    hide(id);
    startTransition(() => removeItem(id));
  };

  const enterShop = (storeId: string) => {
    setBasket([]);
    setShopId(storeId);
  };
  const leaveShop = () => {
    setBasket([]);
    setShopId(null);
  };

  if (shopId) {
    const store = storeById.get(shopId);
    if (!store) {
      // Store vanished under us (hidden or deleted in admin mid-trip); offer a
      // way back rather than mutating state during render.
      return (
        <div className="rounded-2xl border border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-muted">That store isn’t available anymore.</p>
          <button
            type="button"
            onClick={leaveShop}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-white"
          >
            Back to list
          </button>
        </div>
      );
    }
    return (
      <ShopView
        store={store}
        toGet={live.filter((i) => i.storeId === shopId)}
        basket={basket}
        pending={pending}
        onCheck={checkOff}
        onUndo={undo}
        onDone={leaveShop}
      />
    );
  }

  return (
    <ListView
      stores={stores}
      items={live}
      catalog={catalog}
      roster={roster}
      pending={pending}
      onAdd={(payload) => startTransition(() => addItem(payload))}
      onAddCatalog={(catalogId, storeId) =>
        startTransition(() => addFromCatalog(catalogId, storeId))
      }
      onAssign={(id, uid) => startTransition(() => assignItem(id, uid))}
      onRemove={dropFromList}
      onShop={enterShop}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  List mode — add things, see what's needed per store, start a trip  */
/* ------------------------------------------------------------------ */

function ListView({
  stores,
  items,
  catalog,
  roster,
  pending,
  onAdd,
  onAddCatalog,
  onAssign,
  onRemove,
  onShop,
}: {
  stores: StoreView[];
  items: ShoppingItemView[];
  catalog: CatalogSuggestion[];
  roster: Person[];
  pending: boolean;
  onAdd: (p: { name: string; storeId: string; assignedToId: string | null }) => void;
  onAddCatalog: (catalogId: string, storeId?: string) => void;
  onAssign: (id: string, uid: string | null) => void;
  onRemove: (id: string) => void;
  onShop: (storeId: string) => void;
}) {
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [assignee, setAssignee] = useState("");
  const [focused, setFocused] = useState(false);

  const q = name.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return catalog
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [catalog, q]);
  const exact = catalog.some((c) => c.name.toLowerCase() === q);

  const common = useMemo(() => catalog.slice(0, 12), [catalog]);

  const submitTyped = () => {
    if (!name.trim() || !storeId) return;
    onAdd({ name, storeId, assignedToId: assignee || null });
    setName("");
  };

  const pickCatalog = (c: CatalogSuggestion) => {
    onAddCatalog(c.id, c.defaultStoreId ?? storeId);
    setName("");
  };

  const countFor = (id: string) =>
    items.filter((i) => i.storeId === id).length;

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
                  if (matches.length && !exact) pickCatalog(matches[0]);
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
                    onClick={() => pickCatalog(c)}
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

          {stores.length > 1 && (
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              aria-label="Store"
              className="h-11 rounded-full border border-hairline bg-ground/40 px-4 text-sm outline-none focus:border-accent"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            aria-label="For whom"
            className="h-11 rounded-full border border-hairline bg-ground/40 px-4 text-sm outline-none focus:border-accent"
          >
            <option value="">Anyone</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={submitTyped}
            disabled={pending || !name.trim() || !storeId}
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
                  onClick={() => onAddCatalog(c.id, c.defaultStoreId ?? storeId)}
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

      {/* Per-store cards */}
      <div className="space-y-4">
        {stores.map((s) => {
          const list = items.filter((i) => i.storeId === s.id);
          const count = countFor(s.id);
          return (
            <div
              key={s.id}
              className="overflow-hidden rounded-2xl border border-hairline bg-surface"
            >
              <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
                <span className="text-2xl" aria-hidden>
                  {s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold leading-tight">
                    {s.name}
                  </p>
                  <p className="tabular text-xs text-muted">
                    {count === 0
                      ? "Nothing needed"
                      : `${count} item${count === 1 ? "" : "s"} to get`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onShop(s.id)}
                  disabled={count === 0}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-40"
                >
                  <CartIcon className="h-4 w-4" />
                  Shop
                </button>
              </div>

              {list.length > 0 && (
                <div className="divide-y divide-hairline">
                  {list.map((item) => (
                    <ListRow
                      key={item.id}
                      item={item}
                      roster={roster}
                      onAssign={(uid) => onAssign(item.id, uid)}
                      onRemove={() => onRemove(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListRow({
  item,
  roster,
  onAssign,
  onRemove,
}: {
  item: ShoppingItemView;
  roster: Person[];
  onAssign: (uid: string | null) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
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

      <select
        value={item.assignee?.id ?? ""}
        onChange={(e) => onAssign(e.target.value || null)}
        aria-label="For whom"
        className="h-9 max-w-[7rem] rounded-full border border-hairline bg-ground/40 px-3 text-xs outline-none focus:border-accent"
      >
        <option value="">Anyone</option>
        {roster.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-red-700"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shop mode — one store, big taps, checked items leave the cart       */
/* ------------------------------------------------------------------ */

function ShopView({
  store,
  toGet,
  basket,
  pending,
  onCheck,
  onUndo,
  onDone,
}: {
  store: StoreView;
  toGet: ShoppingItemView[];
  basket: BasketEntry[];
  pending: boolean;
  onCheck: (item: ShoppingItemView) => void;
  onUndo: (entry: BasketEntry) => void;
  onDone: () => void;
}) {
  const got = basket.length;
  const total = toGet.length + got;
  const pct = total === 0 ? 0 : Math.round((got / total) * 100);
  const allDone = toGet.length === 0 && got > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-hairline bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Done
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-2xl" aria-hidden>
            {store.icon}
          </span>
          <h2 className="truncate font-display text-xl font-semibold">
            {store.name}
          </h2>
        </div>
        {total > 0 && (
          <span className="tabular shrink-0 text-sm font-medium text-muted">
            {got}/{total}
          </span>
        )}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-ground/60">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Checklist */}
      {toGet.length > 0 ? (
        <div className="space-y-2">
          {toGet.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onCheck(item)}
              disabled={pending}
              className="flex w-full items-center gap-4 rounded-2xl border border-hairline bg-surface px-4 py-4 text-left transition-colors hover:border-accent active:bg-accent/5 disabled:opacity-60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-hairline text-transparent transition-colors">
                <CheckIcon className="h-5 w-5" />
              </span>
              <span className="text-2xl" aria-hidden>
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">
                  {item.name}
                </span>
                {item.note && (
                  <span className="block truncate text-sm text-muted">
                    {item.note}
                  </span>
                )}
              </span>
              {item.assignee && (
                <Avatar
                  name={item.assignee.name}
                  color={item.assignee.color}
                  avatarPath={item.assignee.avatarPath}
                  avatarPosition={item.assignee.avatarPosition}
                  size="sm"
                />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-hairline bg-surface p-8 text-center">
          <p className="text-3xl">{allDone ? "🎉" : "🛒"}</p>
          <p className="mt-2 text-sm font-medium">
            {allDone ? "All done — nice work!" : "Nothing to get here."}
          </p>
          <button
            type="button"
            onClick={onDone}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
          >
            Finish shopping
          </button>
        </div>
      )}

      {/* Undo basket */}
      {basket.length > 0 && (
        <div className="rounded-2xl border border-hairline bg-ground/30 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">
            In the basket ({basket.length})
          </p>
          <div className="space-y-1.5">
            {basket.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center gap-3 text-sm text-muted"
              >
                <CheckIcon className="h-4 w-4 shrink-0 text-accent" />
                <span className="text-lg" aria-hidden>
                  {entry.icon}
                </span>
                <span className="flex-1 truncate line-through">
                  {entry.name}
                </span>
                <button
                  type="button"
                  onClick={() => onUndo(entry)}
                  className="shrink-0 text-xs font-medium text-accent underline hover:no-underline"
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

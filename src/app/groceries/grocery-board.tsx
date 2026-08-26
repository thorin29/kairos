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
  removeItem,
  restoreItem,
} from "@/lib/actions/groceries";
import type {
  CatalogSuggestion,
  ShoppingItemView,
  StoreView,
} from "@/lib/queries/groceries";

type BasketEntry = {
  key: number;
  name: string;
  icon: string;
  storeId: string;
  assignedToId: string | null;
  note: string | null;
};

// What's waiting on a store to be chosen: either an existing catalog item or a
// brand-new typed name.
type Pending = {
  label: string;
  catalogId?: string;
  defaultStoreId?: string | null;
};

export function GroceryBoard({
  stores,
  items,
  catalog,
}: {
  stores: StoreView[];
  items: ShoppingItemView[];
  catalog: CatalogSuggestion[];
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
      pending={pending}
      onAdd={(name, storeId) => startTransition(() => addItem({ name, storeId }))}
      onAddCatalog={(catalogId, storeId) =>
        startTransition(() => addFromCatalog(catalogId, storeId))
      }
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
  pending,
  onAdd,
  onAddCatalog,
  onRemove,
  onShop,
}: {
  stores: StoreView[];
  items: ShoppingItemView[];
  catalog: CatalogSuggestion[];
  pending: boolean;
  onAdd: (name: string, storeId: string) => void;
  onAddCatalog: (catalogId: string, storeId: string) => void;
  onRemove: (id: string) => void;
  onShop: (storeId: string) => void;
}) {
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const [pick, setPick] = useState<Pending | null>(null);

  const q = name.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [catalog, q]);
  const exact = catalog.some((c) => c.name.toLowerCase() === q);
  const common = useMemo(() => catalog.slice(0, 12), [catalog]);

  const only = stores.length === 1 ? stores[0].id : null;

  // Commit an item: with a single store, drop it straight in; otherwise open
  // the store chooser.
  const commit = (p: Pending) => {
    setName("");
    setFocused(false);
    if (only) {
      if (p.catalogId) onAddCatalog(p.catalogId, only);
      else onAdd(p.label, only);
      return;
    }
    setPick(p);
  };

  const chooseStore = (storeId: string) => {
    if (!pick) return;
    if (pick.catalogId) onAddCatalog(pick.catalogId, storeId);
    else onAdd(pick.label, storeId);
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

  return (
    <div className="space-y-6">
      {/* Add bar — type a name (with suggestions) or tap a common item */}
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

      {/* Per-store cards */}
      <div className="space-y-4">
        {stores.map((s) => {
          const list = items.filter((i) => i.storeId === s.id);
          const count = list.length;
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
                      onRemove={() => onRemove(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Store chooser */}
      {pick && (
        <StorePicker
          label={pick.label}
          stores={stores}
          usualStoreId={pick.defaultStoreId ?? null}
          onChoose={chooseStore}
          onClose={() => setPick(null)}
        />
      )}
    </div>
  );
}

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
  // Put the usual store first so it's the fastest tap.
  const ordered = useMemo(() => {
    if (!usualStoreId) return stores;
    const usual = stores.filter((s) => s.id === usualStoreId);
    const rest = stores.filter((s) => s.id !== usualStoreId);
    return [...usual, ...rest];
  }, [stores, usualStoreId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-hairline bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-muted">Which store for</p>
        <p className="mb-4 truncate font-display text-xl font-semibold">
          {label}?
        </p>
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
              <span className="flex-1 truncate text-base font-medium">
                {s.name}
              </span>
              {s.id === usualStoreId && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  usual
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-10 w-full rounded-full text-sm font-medium text-muted hover:bg-ink/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ListRow({
  item,
  onRemove,
}: {
  item: ShoppingItemView;
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

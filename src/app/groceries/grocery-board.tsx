"use client";

import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { CheckIcon, PlusIcon, TrashIcon } from "@/components/icons";
import {
  addFromCatalog,
  addItem,
  assignItem,
  clearBought,
  removeItem,
  setBought,
} from "@/lib/actions/groceries";
import type {
  CatalogSuggestion,
  ShoppingItemView,
  StoreView,
} from "@/lib/queries/groceries";

type Person = { id: string; name: string; color: string; avatarPath: string | null };

export function GroceryBoard({
  stores,
  items,
  suggestions,
  roster,
}: {
  stores: StoreView[];
  items: ShoppingItemView[];
  suggestions: CatalogSuggestion[];
  roster: Person[];
}) {
  const [store, setStore] = useState<string>("all");
  const [name, setName] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [pending, startTransition] = useTransition();

  // When "All" is selected there's no single target store, so typed items need
  // one chosen; otherwise the active tab is the target.
  const [addStoreId, setAddStoreId] = useState<string>(stores[0]?.id ?? "");
  const targetStore = store === "all" ? addStoreId : store;

  const visible = useMemo(
    () => (store === "all" ? items : items.filter((i) => i.storeId === store)),
    [items, store],
  );
  const toBuy = visible.filter((i) => !i.bought);
  const bought = visible.filter((i) => i.bought);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? "";
  const storeIcon = (id: string) => stores.find((s) => s.id === id)?.icon ?? "🛒";

  const submit = () => {
    if (!name.trim() || !targetStore) return;
    const payload = { name, storeId: targetStore, assignedToId: assignee || null };
    setName("");
    startTransition(() => addItem(payload));
  };

  const tab =
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors";

  return (
    <div className="space-y-6">
      {/* Which store am I shopping? Also the filter for the list below. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStore("all")}
          className={`${tab} ${
            store === "all"
              ? "border-accent bg-accent text-white"
              : "border-hairline text-muted hover:border-accent"
          }`}
        >
          Everything
        </button>
        {stores.map((s) => {
          const on = store === s.id;
          const count = items.filter((i) => i.storeId === s.id && !i.bought).length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStore(s.id)}
              className={`${tab} ${
                on
                  ? "border-accent bg-accent text-white"
                  : "border-hairline text-muted hover:border-accent"
              }`}
            >
              <span aria-hidden>{s.icon}</span>
              {s.name}
              {count > 0 && (
                <span
                  className={`tabular text-xs ${on ? "text-white/80" : "text-muted"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add a needed item */}
      <div className="rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Add an item…"
            className="h-11 min-w-[10rem] flex-1 rounded-full border border-hairline bg-ground/40 px-5 outline-none focus:border-accent"
          />

          {store === "all" && stores.length > 1 && (
            <select
              value={addStoreId}
              onChange={(e) => setAddStoreId(e.target.value)}
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
            onClick={submit}
            disabled={pending || !name.trim() || !targetStore}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted">
              Common
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      addFromCatalog(
                        s.id,
                        store === "all" ? undefined : store,
                      ),
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  <span aria-hidden>{s.icon}</span>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* The list */}
      {toBuy.length === 0 && bought.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-6 text-center text-sm text-muted">
          Nothing on the list{store === "all" ? "" : ` for ${storeName(store)}`}.
          Add something above.
        </p>
      ) : (
        <div className="space-y-2">
          {toBuy.map((item) => (
            <Row
              key={item.id}
              item={item}
              roster={roster}
              showStore={store === "all"}
              storeLabel={`${storeIcon(item.storeId)} ${storeName(item.storeId)}`}
              onToggle={() => startTransition(() => setBought(item.id, true))}
              onAssign={(uid) => startTransition(() => assignItem(item.id, uid))}
              onRemove={() => startTransition(() => removeItem(item.id))}
            />
          ))}

          {bought.length > 0 && (
            <div className="pt-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-widest text-muted">
                  In the cart
                </p>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      clearBought(store === "all" ? undefined : store),
                    )
                  }
                  className="text-xs font-medium text-muted underline hover:text-red-700"
                >
                  Clear bought
                </button>
              </div>
              {bought.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  roster={roster}
                  showStore={store === "all"}
                  storeLabel={`${storeIcon(item.storeId)} ${storeName(item.storeId)}`}
                  onToggle={() => startTransition(() => setBought(item.id, false))}
                  onAssign={(uid) => startTransition(() => assignItem(item.id, uid))}
                  onRemove={() => startTransition(() => removeItem(item.id))}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  item,
  roster,
  showStore,
  storeLabel,
  onToggle,
  onAssign,
  onRemove,
}: {
  item: ShoppingItemView;
  roster: Person[];
  showStore: boolean;
  storeLabel: string;
  onToggle: () => void;
  onAssign: (userId: string | null) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl border px-4 py-3",
        item.bought
          ? "border-hairline bg-ground/30 opacity-60"
          : "border-hairline bg-surface",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={item.bought ? "Move back to list" : "Mark as bought"}
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
          item.bought
            ? "border-accent bg-accent text-white"
            : "border-hairline text-transparent hover:border-accent",
        ].join(" ")}
      >
        <CheckIcon className="h-4 w-4" />
      </button>

      <span className="text-xl" aria-hidden>
        {item.icon}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${item.bought ? "line-through" : ""}`}
        >
          {item.name}
        </p>
        {showStore && (
          <p className="truncate text-xs text-muted">{storeLabel}</p>
        )}
      </div>

      {item.assignee && (
        <Avatar
          name={item.assignee.name}
          color={item.assignee.color}
          avatarPath={item.assignee.avatarPath}
          size="sm"
        />
      )}

      <select
        value={item.assignee?.id ?? ""}
        onChange={(e) => onAssign(e.target.value || null)}
        aria-label="Assign to"
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

"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import {
  addCatalogItem,
  addStore,
  deleteCatalogItem,
  deleteStore,
  renameCatalogItem,
  renameStore,
  setCatalogActive,
  setCatalogIcon,
  setCatalogStore,
  setStoreActive,
  setStoreIcon,
} from "@/lib/actions/groceries";
import type { AdminCatalogItem, AdminStore } from "@/lib/queries/groceries";

export function GroceryAdmin({
  stores,
  catalog,
}: {
  stores: AdminStore[];
  catalog: AdminCatalogItem[];
}) {
  const [, startTransition] = useTransition();

  const [storeName, setStoreName] = useState("");
  const [storeIcon, setNewStoreIcon] = useState("🏬");

  const [itemName, setItemName] = useState("");
  const [itemIcon, setItemIcon] = useState("");
  const [itemStore, setItemStore] = useState<string>("");

  return (
    <div className="space-y-10">
      {/* Stores */}
      <Card className="p-5">
        <div className="mb-4 divide-y divide-hairline">
          {stores.map((s) => (
            <StoreRow key={s.id} store={s} startTransition={startTransition} />
          ))}
          {stores.length === 0 && (
            <p className="py-2 text-sm text-muted">No stores yet.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={storeIcon}
            onChange={(e) => setNewStoreIcon(e.target.value)}
            aria-label="Store icon"
            className="h-10 w-14 rounded-full border border-hairline bg-ground/40 text-center outline-none focus:border-accent"
          />
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="New store (e.g. Costco)"
            className="h-10 min-w-[10rem] flex-1 rounded-full border border-hairline bg-ground/40 px-4 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => {
              if (!storeName.trim()) return;
              startTransition(() => addStore(storeName, storeIcon));
              setStoreName("");
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-white"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>
      </Card>

      {/* Catalog */}
      <section>
        <SectionHeading>Catalog</SectionHeading>

        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={itemIcon}
              onChange={(e) => setItemIcon(e.target.value)}
              placeholder="🍎"
              aria-label="Item icon"
              className="h-10 w-14 rounded-full border border-hairline bg-ground/40 text-center outline-none focus:border-accent"
            />
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="New catalog item"
              className="h-10 min-w-[10rem] flex-1 rounded-full border border-hairline bg-ground/40 px-4 text-sm outline-none focus:border-accent"
            />
            <select
              value={itemStore}
              onChange={(e) => setItemStore(e.target.value)}
              className="h-10 rounded-full border border-hairline bg-ground/40 px-3 text-sm outline-none focus:border-accent"
            >
              <option value="">No default store</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!itemName.trim()) return;
                startTransition(() =>
                  addCatalogItem({
                    name: itemName,
                    icon: itemIcon || undefined,
                    defaultStoreId: itemStore || null,
                  }),
                );
                setItemName("");
                setItemIcon("");
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-white"
            >
              <PlusIcon className="h-4 w-4" />
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Leave the icon blank and one is guessed from the name.
          </p>
        </Card>

        <Card className="divide-y divide-hairline">
          {catalog.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              Empty — it fills in as people add things to the list.
            </p>
          ) : (
            catalog.map((item) => (
              <CatalogRow
                key={item.id}
                item={item}
                stores={stores}
                startTransition={startTransition}
              />
            ))
          )}
        </Card>
      </section>
    </div>
  );
}

function StoreRow({
  store,
  startTransition,
}: {
  store: AdminStore;
  startTransition: (fn: () => void) => void;
}) {
  const [taken, setTaken] = useState(false);

  const saveName = (v: string) => {
    const next = v.trim();
    setTaken(false);
    if (!next || next === store.name) return;
    startTransition(async () => {
      const res = await renameStore(store.id, next);
      if (!res.ok && res.reason === "duplicate") setTaken(true);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2.5">
      <input
        defaultValue={store.icon}
        key={`icon-${store.icon}`}
        aria-label={`${store.name} icon`}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== store.icon) {
            startTransition(() => setStoreIcon(store.id, v));
          }
        }}
        className="h-9 w-12 rounded-lg border border-hairline bg-ground/40 text-center outline-none focus:border-accent"
      />
      <input
        defaultValue={store.name}
        key={`name-${store.name}`}
        aria-label="Store name"
        onBlur={(e) => saveName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-9 min-w-[8rem] flex-1 rounded-lg border border-hairline bg-ground/40 px-3 text-sm font-medium outline-none focus:border-accent"
      />
      {taken && <span className="text-xs text-red-700">Name taken</span>}
      <span className="tabular text-xs text-muted">
        {store.itemCount > 0 ? `${store.itemCount} on list` : "empty"}
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => setStoreActive(store.id, !store.isActive))}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${
          store.isActive
            ? "border-accent text-accent"
            : "border-hairline text-muted"
        }`}
      >
        {store.isActive ? "Active" : "Hidden"}
      </button>
      <button
        type="button"
        disabled={store.itemCount > 0}
        title={
          store.itemCount > 0
            ? "Clear this store's list before deleting"
            : "Delete store"
        }
        onClick={() => {
          if (confirm(`Delete the store “${store.name}”?`)) {
            startTransition(() => deleteStore(store.id));
          }
        }}
        aria-label="Delete store"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-red-700 disabled:opacity-30 disabled:hover:text-muted"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function CatalogRow({
  item,
  stores,
  startTransition,
}: {
  item: AdminCatalogItem;
  stores: AdminStore[];
  startTransition: (fn: () => void) => void;
}) {
  const [taken, setTaken] = useState(false);

  const saveName = (v: string) => {
    const next = v.trim();
    setTaken(false);
    if (!next || next === item.name) return;
    startTransition(async () => {
      const res = await renameCatalogItem(item.id, next);
      if (!res.ok && res.reason === "duplicate") setTaken(true);
    });
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 p-3 ${item.isActive ? "" : "opacity-50"}`}
    >
      <input
        defaultValue={item.icon}
        key={`icon-${item.icon}`}
        aria-label={`${item.name} icon`}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== item.icon) {
            startTransition(() => setCatalogIcon(item.id, v));
          }
        }}
        className="h-9 w-12 rounded-lg border border-hairline bg-ground/40 text-center outline-none focus:border-accent"
      />
      <div className="min-w-[8rem] flex-1">
        <input
          defaultValue={item.name}
          key={`name-${item.name}`}
          aria-label="Item name"
          onBlur={(e) => saveName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-9 w-full rounded-lg border border-hairline bg-ground/40 px-3 text-sm font-medium outline-none focus:border-accent"
        />
        <p className="tabular mt-0.5 text-xs text-muted">
          used {item.useCount}×{taken && " · name taken"}
        </p>
      </div>
      <select
        value={item.defaultStoreId ?? ""}
        onChange={(e) =>
          startTransition(() => setCatalogStore(item.id, e.target.value || null))
        }
        aria-label="Default store"
        className="h-9 rounded-lg border border-hairline bg-ground/40 px-2 text-xs outline-none focus:border-accent"
      >
        <option value="">No store</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.icon} {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => startTransition(() => setCatalogActive(item.id, !item.isActive))}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${
          item.isActive
            ? "border-hairline text-muted hover:border-accent"
            : "border-accent text-accent"
        }`}
      >
        {item.isActive ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm(`Delete “${item.name}” from the catalog?`)) {
            startTransition(() => deleteCatalogItem(item.id));
          }
        }}
        aria-label="Delete item"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-red-700"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

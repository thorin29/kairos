"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import {
  addCatalogItem,
  addStore,
  setCatalogActive,
  setCatalogIcon,
  setStoreActive,
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
  const [storeIcon, setStoreIcon] = useState("🏬");

  const [itemName, setItemName] = useState("");
  const [itemIcon, setItemIcon] = useState("");
  const [itemStore, setItemStore] = useState<string>("");

  const storeById = (id: string | null) =>
    id ? stores.find((s) => s.id === id)?.name ?? "" : "";

  return (
    <div className="space-y-10">
      <Card className="p-5">
        <div className="mb-4 divide-y divide-hairline">
          {stores.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5">
              <span className="text-xl" aria-hidden>
                {s.icon}
              </span>
              <span className="flex-1 text-sm font-medium">{s.name}</span>
              <button
                type="button"
                onClick={() =>
                  startTransition(() => setStoreActive(s.id, !s.isActive))
                }
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  s.isActive
                    ? "border-accent text-accent"
                    : "border-hairline text-muted"
                }`}
              >
                {s.isActive ? "Active" : "Hidden"}
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={storeIcon}
            onChange={(e) => setStoreIcon(e.target.value)}
            aria-label="Store icon"
            className="h-10 w-14 rounded-full border border-hairline bg-ground/40 text-center outline-none focus:border-accent"
          />
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="New store (e.g. Clothing)"
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
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 ${item.isActive ? "" : "opacity-50"}`}
              >
                <input
                  defaultValue={item.icon}
                  aria-label={`${item.name} icon`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== item.icon) {
                      startTransition(() => setCatalogIcon(item.id, v));
                    }
                  }}
                  className="h-9 w-12 rounded-lg border border-hairline bg-ground/40 text-center outline-none focus:border-accent"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="tabular text-xs text-muted">
                    {storeById(item.defaultStoreId) || "no store"} · used{" "}
                    {item.useCount}×
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      setCatalogActive(item.id, !item.isActive),
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    item.isActive
                      ? "border-hairline text-muted hover:border-accent"
                      : "border-accent text-accent"
                  }`}
                >
                  {item.isActive ? "Hide" : "Show"}
                </button>
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}

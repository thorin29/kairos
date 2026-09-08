"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { currentUser } from "@/lib/user-session";
import { deviceMode } from "@/lib/device";
import { guessIcon, normalizeName } from "@/lib/groceries/catalog";
import {
  addItemCore,
  addFromCatalogCore,
  assignItemCore,
  removeItemCore,
  startTripCore,
  setPurchasedCore,
  completeTripCore,
} from "@/lib/groceries-core";

/**
 * Who to attribute a newly-added item to. On a personal device we log the
 * signed-in person as the requester; on the shared hub it's left unassigned,
 * because there "who asked" isn't meaningful.
 */
async function requesterId(explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  const me = await currentUser();
  if (me && (await deviceMode()) === "personal") return me.id;
  return null;
}

function refresh() {
  revalidatePath("/groceries");
  revalidatePath("/admin/groceries");
  revalidatePath("/");
}

export async function addItem(input: {
  name: string;
  storeId: string;
  assignedToId?: string | null;
  note?: string | null;
}): Promise<void> {
  await requireInteractive();
  await addItemCore({
    name: input.name,
    storeId: input.storeId,
    requesterId: await requesterId(input.assignedToId),
    note: input.note,
  });
  refresh();
}

/** Add straight from a catalog suggestion (its remembered store, unless told). */
export async function addFromCatalog(catalogId: string, storeId?: string): Promise<void> {
  await requireInteractive();
  await addFromCatalogCore(catalogId, storeId, await requesterId());
  refresh();
}

export async function assignItem(itemId: string, userId: string | null): Promise<void> {
  await requireInteractive();
  await assignItemCore(itemId, userId);
  refresh();
}

/**
 * Take a line off the list. This is both "we don't need this after all" from
 * the list and "got it" from the shopping cart — either way the line is done
 * and leaves the shared list.
 */
export async function removeItem(itemId: string): Promise<void> {
  await requireInteractive();
  await removeItemCore(itemId);
  refresh();
}

// --- shopping trips ------------------------------------------------------

export async function startTrip(
  storeId: string,
  shopperId: string,
): Promise<{ ok: boolean; reason?: string }> {
  await requireInteractive();
  const res = await startTripCore(storeId, shopperId);
  if (res.ok) refresh();
  return res;
}

export async function setPurchased(itemId: string, purchased: boolean): Promise<void> {
  await requireInteractive();
  await setPurchasedCore(itemId, purchased);
  refresh();
}

export async function completeTrip(tripId: string): Promise<void> {
  await requireInteractive();
  await completeTripCore(tripId);
  refresh();
}

/**
 * Persist a drag: for each affected store, the ordered ids become that store's
 * order (sortOrder = position), and every listed line is pinned to that store —
 * so the same call handles reordering within a store and dragging a line onto
 * another store. Only saved lines move (trip lines are excluded), and only the
 * stores the drag touched are passed, so nothing else is disturbed.
 */
export async function saveOrder(
  groups: { storeId: string; itemIds: string[] }[],
): Promise<void> {
  await requireInteractive();
  const writes = groups.flatMap((g) =>
    g.itemIds.map((id, i) =>
      prisma.shoppingItem.updateMany({
        where: { id, tripId: null },
        data: { storeId: g.storeId, sortOrder: i },
      }),
    ),
  );
  if (writes.length === 0) return;
  await prisma.$transaction(writes);
  refresh();
}

// --- admin: catalog and stores ------------------------------------------

export async function setCatalogIcon(
  catalogId: string,
  icon: string,
): Promise<void> {
  await requireAdmin();
  const trimmed = icon.trim().slice(0, 8);
  if (!trimmed) return;
  const item = await prisma.groceryItem.findUnique({ where: { id: catalogId } });
  if (!item) return;
  // Keep any lines already on the list in step with the catalog — in this
  // model a line is just "currently needed", not kept history, so a corrected
  // icon should show everywhere the item appears.
  await prisma.$transaction([
    prisma.groceryItem.update({
      where: { id: catalogId },
      data: { icon: trimmed },
    }),
    prisma.shoppingItem.updateMany({
      where: { name: item.name },
      data: { icon: trimmed },
    }),
  ]);
  refresh();
}

/** Rename a catalog item. Names are unique; a clash is left as a no-op. The
 *  matching lines already on the list are renamed too, so fixing a misspelling
 *  corrects it everywhere it currently appears. */
export async function renameCatalogItem(
  catalogId: string,
  name: string,
): Promise<{ ok: boolean; reason?: string }> {
  await requireAdmin();
  const clean = normalizeName(name);
  if (!clean) return { ok: false, reason: "empty" };
  const item = await prisma.groceryItem.findUnique({ where: { id: catalogId } });
  if (!item) return { ok: false, reason: "missing" };
  if (clean === item.name) return { ok: true };
  const clash = await prisma.groceryItem.findUnique({ where: { name: clean } });
  if (clash && clash.id !== catalogId) {
    return { ok: false, reason: "duplicate" };
  }
  await prisma.$transaction([
    prisma.groceryItem.update({
      where: { id: catalogId },
      data: { name: clean },
    }),
    prisma.shoppingItem.updateMany({
      where: { name: item.name },
      data: { name: clean },
    }),
  ]);
  refresh();
  return { ok: true };
}

export async function setCatalogStore(
  catalogId: string,
  storeId: string | null,
): Promise<void> {
  await requireAdmin();
  await prisma.groceryItem.update({
    where: { id: catalogId },
    data: { defaultStoreId: storeId || null },
  });
  refresh();
}

export async function setCatalogActive(
  catalogId: string,
  active: boolean,
): Promise<void> {
  await requireAdmin();
  await prisma.groceryItem.update({
    where: { id: catalogId },
    data: { isActive: active },
  });
  refresh();
}

export async function deleteCatalogItem(catalogId: string): Promise<void> {
  await requireAdmin();
  await prisma.groceryItem.deleteMany({ where: { id: catalogId } });
  refresh();
}

export async function addCatalogItem(input: {
  name: string;
  icon?: string;
  defaultStoreId?: string | null;
}): Promise<void> {
  await requireAdmin();
  const name = normalizeName(input.name);
  if (!name) return;
  await prisma.groceryItem.upsert({
    where: { name },
    update: {
      isActive: true,
      ...(input.icon ? { icon: input.icon.trim().slice(0, 8) } : {}),
      ...(input.defaultStoreId ? { defaultStoreId: input.defaultStoreId } : {}),
    },
    create: {
      name,
      icon: input.icon?.trim().slice(0, 8) || guessIcon(name),
      defaultStoreId: input.defaultStoreId || null,
    },
  });
  refresh();
}

export async function addStore(name: string, icon: string): Promise<void> {
  await requireAdmin();
  const clean = name.trim().slice(0, 40);
  if (!clean) return;
  const count = await prisma.store.count();
  await prisma.store.upsert({
    where: { name: clean },
    update: { isActive: true, icon: icon.trim().slice(0, 8) || "🛒" },
    create: {
      name: clean,
      icon: icon.trim().slice(0, 8) || "🛒",
      sortOrder: count,
    },
  });
  refresh();
}

export async function renameStore(
  storeId: string,
  name: string,
): Promise<{ ok: boolean; reason?: string }> {
  await requireAdmin();
  const clean = name.trim().slice(0, 40);
  if (!clean) return { ok: false, reason: "empty" };
  const clash = await prisma.store.findUnique({ where: { name: clean } });
  if (clash && clash.id !== storeId) return { ok: false, reason: "duplicate" };
  await prisma.store.update({ where: { id: storeId }, data: { name: clean } });
  refresh();
  return { ok: true };
}

export async function setStoreIcon(
  storeId: string,
  icon: string,
): Promise<void> {
  await requireAdmin();
  const trimmed = icon.trim().slice(0, 8) || "🛒";
  await prisma.store.update({
    where: { id: storeId },
    data: { icon: trimmed },
  });
  refresh();
}

export async function setStoreActive(
  storeId: string,
  active: boolean,
): Promise<void> {
  await requireAdmin();
  await prisma.store.update({
    where: { id: storeId },
    data: { isActive: active },
  });
  refresh();
}

/**
 * Delete a store outright. Deleting one cascades to any lines still under it,
 * so the admin UI only offers this once a store is empty; the guard here is
 * the backstop.
 */
export async function deleteStore(storeId: string): Promise<{ ok: boolean; reason?: string }> {
  await requireAdmin();
  const lines = await prisma.shoppingItem.count({ where: { storeId } });
  if (lines > 0) return { ok: false, reason: "not-empty" };
  await prisma.store.deleteMany({ where: { id: storeId } });
  refresh();
  return { ok: true };
}

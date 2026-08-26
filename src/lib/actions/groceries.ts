"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { guessIcon, normalizeName } from "@/lib/groceries/catalog";

function refresh() {
  revalidatePath("/groceries");
  revalidatePath("/admin/groceries");
}

/**
 * Add a needed item to the list. Finds or creates its catalog entry (bumping
 * the use count and reusing or guessing an icon), then drops a snapshot line
 * onto the list. Deliberately open to anyone — it's the shared screen; the
 * whole point is that anyone can say "we're out of milk".
 */
export async function addItem(input: {
  name: string;
  storeId: string;
  assignedToId?: string | null;
  note?: string | null;
}): Promise<void> {
  await requireInteractive();
  const name = normalizeName(input.name);
  if (!name || !input.storeId) return;

  const store = await prisma.store.findUnique({ where: { id: input.storeId } });
  if (!store) return;

  const existing = await prisma.groceryItem.findUnique({ where: { name } });
  const icon = existing?.icon ?? guessIcon(name);

  await prisma.groceryItem.upsert({
    where: { name },
    update: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    create: {
      name,
      icon,
      defaultStoreId: input.storeId,
      useCount: 1,
    },
  });

  await prisma.shoppingItem.create({
    data: {
      name,
      icon,
      storeId: input.storeId,
      assignedToId: input.assignedToId || null,
      note: input.note?.trim() || null,
    },
  });

  refresh();
}

/** Add straight from a catalog suggestion (its remembered store, unless told). */
export async function addFromCatalog(
  catalogId: string,
  storeId?: string,
): Promise<void> {
  await requireInteractive();
  const item = await prisma.groceryItem.findUnique({ where: { id: catalogId } });
  if (!item) return;

  const targetStore = storeId || item.defaultStoreId;
  if (!targetStore) return;

  await prisma.groceryItem.update({
    where: { id: item.id },
    data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
  });

  await prisma.shoppingItem.create({
    data: { name: item.name, icon: item.icon, storeId: targetStore },
  });

  refresh();
}

export async function assignItem(
  itemId: string,
  userId: string | null,
): Promise<void> {
  await requireInteractive();
  await prisma.shoppingItem.update({
    where: { id: itemId },
    data: { assignedToId: userId },
  });
  refresh();
}

/**
 * Take a line off the list. This is both "we don't need this after all" from
 * the list and "got it" from the shopping cart — either way the line is done
 * and leaves the shared list. The catalog memory isn't touched (it already
 * learned when the item was added), so nothing to unwind here.
 */
export async function removeItem(itemId: string): Promise<void> {
  await requireInteractive();
  await prisma.shoppingItem.deleteMany({ where: { id: itemId } });
  refresh();
}

/**
 * Put a just-checked line back, for the "undo" during a shopping trip. It
 * recreates the line as it was without bumping the catalog again, so an
 * accidental tap costs nothing.
 */
export async function restoreItem(input: {
  name: string;
  icon: string;
  storeId: string;
  assignedToId?: string | null;
  note?: string | null;
}): Promise<void> {
  await requireInteractive();
  const store = await prisma.store.findUnique({ where: { id: input.storeId } });
  if (!store) return;
  await prisma.shoppingItem.create({
    data: {
      name: input.name,
      icon: input.icon,
      storeId: input.storeId,
      assignedToId: input.assignedToId || null,
      note: input.note?.trim() || null,
    },
  });
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
  await prisma.groceryItem.update({
    where: { id: catalogId },
    data: { icon: trimmed },
  });
  refresh();
}

/** Rename a catalog item. Names are unique; a clash is left as a no-op. */
export async function renameCatalogItem(
  catalogId: string,
  name: string,
): Promise<{ ok: boolean; reason?: string }> {
  await requireAdmin();
  const clean = normalizeName(name);
  if (!clean) return { ok: false, reason: "empty" };
  const clash = await prisma.groceryItem.findUnique({ where: { name: clean } });
  if (clash && clash.id !== catalogId) {
    return { ok: false, reason: "duplicate" };
  }
  await prisma.groceryItem.update({
    where: { id: catalogId },
    data: { name: clean },
  });
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

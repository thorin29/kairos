"use server";

import { revalidatePath } from "next/cache";
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
}): Promise<void> {
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
    },
  });

  refresh();
}

/** Add straight from a catalog suggestion (its remembered store, unless told). */
export async function addFromCatalog(
  catalogId: string,
  storeId?: string,
): Promise<void> {
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

export async function setBought(itemId: string, bought: boolean): Promise<void> {
  await prisma.shoppingItem.update({
    where: { id: itemId },
    data: { boughtAt: bought ? new Date() : null },
  });
  refresh();
}

export async function assignItem(
  itemId: string,
  userId: string | null,
): Promise<void> {
  await prisma.shoppingItem.update({
    where: { id: itemId },
    data: { assignedToId: userId },
  });
  refresh();
}

export async function removeItem(itemId: string): Promise<void> {
  await prisma.shoppingItem.deleteMany({ where: { id: itemId } });
  refresh();
}

/** Clear everything already bought — optionally just for one store. */
export async function clearBought(storeId?: string): Promise<void> {
  await prisma.shoppingItem.deleteMany({
    where: { boughtAt: { not: null }, ...(storeId ? { storeId } : {}) },
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

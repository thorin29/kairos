"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { currentUser } from "@/lib/user-session";
import { deviceMode } from "@/lib/device";
import { guessIcon, normalizeName } from "@/lib/groceries/catalog";

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

/** The active trip for a store, if one is under way. A line added while a trip
 *  is live joins that trip rather than the saved list. */
async function activeTripId(storeId: string): Promise<string | null> {
  const trip = await prisma.shoppingTrip.findUnique({
    where: { storeId },
    select: { id: true },
  });
  return trip?.id ?? null;
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
      tripId: await activeTripId(input.storeId),
      assignedToId: await requesterId(input.assignedToId),
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
    data: {
      name: item.name,
      icon: item.icon,
      storeId: targetStore,
      tripId: await activeTripId(targetStore),
      assignedToId: await requesterId(),
    },
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

// --- shopping trips ------------------------------------------------------

/**
 * Start a run for a store, claimed by one person. Everything currently on that
 * store's saved list is pulled into the trip, and anything added later joins it
 * too. One trip per store: if a run is already under way this is a no-op, so a
 * double-tap can't hijack someone else's cart. A store with nothing on it can
 * still be started — items can be added into the trip while out.
 */
export async function startTrip(
  storeId: string,
  shopperId: string,
): Promise<{ ok: boolean; reason?: string }> {
  await requireInteractive();
  const [store, shopper, existing] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId } }),
    prisma.user.findUnique({ where: { id: shopperId } }),
    prisma.shoppingTrip.findUnique({ where: { storeId } }),
  ]);
  if (!store || !shopper || !shopper.isActive) return { ok: false, reason: "invalid" };
  if (existing) return { ok: false, reason: "in-progress" };

  let trip;
  try {
    trip = await prisma.shoppingTrip.create({
      data: { storeId, shopperId },
    });
  } catch {
    // Lost a race to the unique storeId — someone else just started it.
    return { ok: false, reason: "in-progress" };
  }
  // Pull the saved list for this store into the trip, unpurchased.
  await prisma.shoppingItem.updateMany({
    where: { storeId, tripId: null },
    data: { tripId: trip.id, boughtAt: null },
  });
  refresh();
  return { ok: true };
}

/** Mark / unmark a line as purchased within its trip. The line stays visible
 *  (struck through) until the trip is completed. */
export async function setPurchased(
  itemId: string,
  purchased: boolean,
): Promise<void> {
  await requireInteractive();
  await prisma.shoppingItem.update({
    where: { id: itemId },
    data: { boughtAt: purchased ? new Date() : null },
  });
  refresh();
}

/**
 * Finish the trip: the purchased lines drop off for good, and anything not
 * bought returns to the saved list for next time. The trip row is removed, so
 * the store is back to "Shop".
 */
export async function completeTrip(tripId: string): Promise<void> {
  await requireInteractive();
  const trip = await prisma.shoppingTrip.findUnique({ where: { id: tripId } });
  if (!trip) return;
  await prisma.$transaction([
    prisma.shoppingItem.deleteMany({
      where: { tripId, boughtAt: { not: null } },
    }),
    prisma.shoppingItem.updateMany({
      where: { tripId },
      data: { tripId: null, boughtAt: null },
    }),
    prisma.shoppingTrip.delete({ where: { id: tripId } }),
  ]);
  refresh();
}

/**
 * Abandon the trip without shopping: every line goes back to the saved list
 * unpurchased, and the store returns to "Shop" for anyone to claim.
 */
export async function dropTrip(tripId: string): Promise<void> {
  await requireInteractive();
  const trip = await prisma.shoppingTrip.findUnique({ where: { id: tripId } });
  if (!trip) return;
  await prisma.$transaction([
    prisma.shoppingItem.updateMany({
      where: { tripId },
      data: { tripId: null, boughtAt: null },
    }),
    prisma.shoppingTrip.delete({ where: { id: tripId } }),
  ]);
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

import "server-only";
import { prisma } from "@/lib/prisma";
import { guessIcon, normalizeName } from "@/lib/groceries/catalog";

/**
 * Session-free grocery operations shared by the web server actions (behind an
 * Authelia session) and the device API routes (behind a bearer token). The
 * grocery list is **shared family data** — deliberately open to any signed-in
 * person or enrolled device, since the whole point is that anyone can say
 * "we're out of milk". Auth lives with the caller; who to attribute an add to
 * is passed in (the signed-in person on a personal device, else nobody).
 *
 * Store membership follows the catalog: each remembered `GroceryItem` keeps a
 * `defaultStoreId`, set the first time it's added and reused after — so the same
 * item lands on the same store's list unless told otherwise.
 */

/** The active trip for a store, if one is under way. A line added while a trip
 *  is live joins that trip rather than the saved list. */
async function activeTripId(storeId: string): Promise<string | null> {
  const trip = await prisma.shoppingTrip.findUnique({
    where: { storeId },
    select: { id: true },
  });
  return trip?.id ?? null;
}

/** Append position for a new saved line, so it lands at the bottom of its
 *  store's list rather than jostling the manual order. */
async function nextSortOrder(storeId: string): Promise<number> {
  const top = await prisma.shoppingItem.aggregate({
    where: { storeId },
    _max: { sortOrder: true },
  });
  return (top._max.sortOrder ?? -1) + 1;
}

/**
 * Add a needed item to the list. Finds or creates its catalog entry (bumping
 * the use count and reusing or guessing an icon, and remembering its store),
 * then drops a snapshot line onto the list (into the store's live trip if one
 * is running, else the saved list).
 */
export async function addItemCore(input: {
  name: string;
  storeId: string;
  requesterId?: string | null;
  note?: string | null;
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
    create: { name, icon, defaultStoreId: input.storeId, useCount: 1 },
  });

  await prisma.shoppingItem.create({
    data: {
      name,
      icon,
      storeId: input.storeId,
      tripId: await activeTripId(input.storeId),
      sortOrder: await nextSortOrder(input.storeId),
      assignedToId: input.requesterId ?? null,
      note: input.note?.trim() || null,
    },
  });
}

/** Add straight from a catalog suggestion (its remembered store, unless told). */
export async function addFromCatalogCore(
  catalogId: string,
  storeId: string | undefined,
  requesterId?: string | null,
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
    data: {
      name: item.name,
      icon: item.icon,
      storeId: targetStore,
      tripId: await activeTripId(targetStore),
      sortOrder: await nextSortOrder(targetStore),
      assignedToId: requesterId ?? null,
    },
  });
}

export async function assignItemCore(itemId: string, userId: string | null): Promise<void> {
  if (!itemId) return;
  await prisma.shoppingItem.update({
    where: { id: itemId },
    data: { assignedToId: userId },
  });
}

/** Take a line off the list — both "don't need it" from the list and "got it"
 *  from the cart. The catalog memory isn't touched. */
export async function removeItemCore(itemId: string): Promise<void> {
  if (!itemId) return;
  await prisma.shoppingItem.deleteMany({ where: { id: itemId } });
}

/**
 * Start a run for a store, claimed by one person. The store's saved list is
 * pulled into the trip; anything added later joins it too. One trip per store:
 * a run already under way makes this a no-op, so a double-tap can't hijack
 * someone else's cart.
 */
export async function startTripCore(
  storeId: string,
  shopperId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const [store, shopper, existing] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId } }),
    prisma.user.findUnique({ where: { id: shopperId } }),
    prisma.shoppingTrip.findUnique({ where: { storeId } }),
  ]);
  if (!store || !shopper || !shopper.isActive) return { ok: false, reason: "invalid" };
  if (existing) return { ok: false, reason: "in-progress" };

  let trip;
  try {
    trip = await prisma.shoppingTrip.create({ data: { storeId, shopperId } });
  } catch {
    return { ok: false, reason: "in-progress" };
  }
  await prisma.shoppingItem.updateMany({
    where: { storeId, tripId: null },
    data: { tripId: trip.id, boughtAt: null },
  });
  return { ok: true };
}

/** Mark / unmark a line as purchased within its trip. The line stays visible
 *  (struck through) until the trip is completed. */
export async function setPurchasedCore(itemId: string, purchased: boolean): Promise<void> {
  if (!itemId) return;
  await prisma.shoppingItem.update({
    where: { id: itemId },
    data: { boughtAt: purchased ? new Date() : null },
  });
}

/**
 * Finish the trip: purchased lines drop off for good, anything not bought
 * returns to the saved list, and the trip row is removed so the store is back
 * to "Shop".
 */
export async function completeTripCore(tripId: string): Promise<void> {
  if (!tripId) return;
  const trip = await prisma.shoppingTrip.findUnique({ where: { id: tripId } });
  if (!trip) return;
  await prisma.$transaction([
    prisma.shoppingItem.deleteMany({ where: { tripId, boughtAt: { not: null } } }),
    prisma.shoppingItem.updateMany({ where: { tripId }, data: { tripId: null, boughtAt: null } }),
    prisma.shoppingTrip.delete({ where: { id: tripId } }),
  ]);
}

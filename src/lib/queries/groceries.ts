import "server-only";
import { prisma } from "@/lib/prisma";

export type StoreView = {
  id: string;
  name: string;
  icon: string;
};

export type Person = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
};

export type ShoppingItemView = {
  id: string;
  name: string;
  icon: string;
  storeId: string;
  note: string | null;
  purchased: boolean;
  assignee: Person | null;
};

export type TripView = {
  id: string;
  storeId: string;
  shopper: Person;
  items: ShoppingItemView[];
  total: number;
  got: number;
};

export type CatalogSuggestion = {
  id: string;
  name: string;
  icon: string;
  defaultStoreId: string | null;
};

export type GroceriesData = {
  stores: StoreView[];
  saved: ShoppingItemView[]; // lines not in a trip (the saved list, per store)
  trips: TripView[]; // active runs, with their lines
  catalog: CatalogSuggestion[];
  roster: Person[];
};

const PERSON_SELECT = {
  id: true,
  name: true,
  color: true,
  avatarPath: true,
  avatarPosition: true,
} as const;

function itemView(i: {
  id: string;
  name: string;
  icon: string;
  storeId: string;
  note: string | null;
  boughtAt: Date | null;
  assignedTo: Person | null;
}): ShoppingItemView {
  return {
    id: i.id,
    name: i.name,
    icon: i.icon,
    storeId: i.storeId,
    note: i.note,
    purchased: i.boughtAt !== null,
    assignee: i.assignedTo,
  };
}

/**
 * Everything the grocery page needs. A line is either on the saved list
 * (`tripId` null) or pulled into an active trip; the two come back separately.
 * The catalog is returned whole (ordered by how often each thing has been
 * added) so the client can both show the common items as one-tap chips and
 * match the rest as you type. The roster feeds the "who's shopping?" picker.
 */
export async function loadGroceries(): Promise<GroceriesData> {
  const [stores, saved, trips, catalog, roster] = await Promise.all([
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, icon: true },
    }),
    prisma.shoppingItem.findMany({
      where: { tripId: null },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        icon: true,
        storeId: true,
        note: true,
        boughtAt: true,
        assignedTo: { select: PERSON_SELECT },
      },
    }),
    prisma.shoppingTrip.findMany({
      orderBy: [{ startedAt: "asc" }],
      select: {
        id: true,
        storeId: true,
        shopper: { select: PERSON_SELECT },
        items: {
          orderBy: [{ boughtAt: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            icon: true,
            storeId: true,
            note: true,
            boughtAt: true,
            assignedTo: { select: PERSON_SELECT },
          },
        },
      },
    }),
    prisma.groceryItem.findMany({
      where: { isActive: true },
      orderBy: [{ useCount: "desc" }, { lastUsedAt: "desc" }, { name: "asc" }],
      take: 500,
      select: { id: true, name: true, icon: true, defaultStoreId: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: PERSON_SELECT,
    }),
  ]);

  return {
    stores,
    saved: saved.map(itemView),
    trips: trips.map((t) => {
      const items = t.items.map(itemView);
      return {
        id: t.id,
        storeId: t.storeId,
        shopper: t.shopper,
        items,
        total: items.length,
        got: items.filter((i) => i.purchased).length,
      };
    }),
    catalog,
    roster,
  };
}

export type DashboardTrip = {
  tripId: string;
  shopperId: string;
  storeName: string;
  storeIcon: string;
  total: number;
  got: number;
};

/** Active trips summarised for the dashboard, so each person's card can carry a
 *  line into their cart. Grouped by shopper on the page. */
export async function loadDashboardTrips(): Promise<DashboardTrip[]> {
  const trips = await prisma.shoppingTrip.findMany({
    select: {
      id: true,
      shopperId: true,
      store: { select: { name: true, icon: true } },
      items: { select: { boughtAt: true } },
    },
  });
  return trips.map((t) => ({
    tripId: t.id,
    shopperId: t.shopperId,
    storeName: t.store.name,
    storeIcon: t.store.icon,
    total: t.items.length,
    got: t.items.filter((i) => i.boughtAt !== null).length,
  }));
}

export type AdminStore = {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
  itemCount: number;
};

export type AdminCatalogItem = {
  id: string;
  name: string;
  icon: string;
  defaultStoreId: string | null;
  useCount: number;
  isActive: boolean;
};

export async function loadGroceryAdmin(): Promise<{
  stores: AdminStore[];
  catalog: AdminCatalogItem[];
}> {
  const [stores, catalog, counts] = await Promise.all([
    prisma.store.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, icon: true, isActive: true },
    }),
    prisma.groceryItem.findMany({
      orderBy: [{ useCount: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        icon: true,
        defaultStoreId: true,
        useCount: true,
        isActive: true,
      },
    }),
    // How many lines currently sit under each store, so the admin can be
    // warned before deleting a store that still has things on the list.
    prisma.shoppingItem.groupBy({
      by: ["storeId"],
      _count: { _all: true },
    }),
  ]);

  const countByStore = new Map(counts.map((c) => [c.storeId, c._count._all]));

  return {
    stores: stores.map((s) => ({
      ...s,
      itemCount: countByStore.get(s.id) ?? 0,
    })),
    catalog,
  };
}

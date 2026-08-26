import "server-only";
import { prisma } from "@/lib/prisma";

export type StoreView = {
  id: string;
  name: string;
  icon: string;
};

export type ShoppingItemView = {
  id: string;
  name: string;
  icon: string;
  storeId: string;
  note: string | null;
  assignee: {
    id: string;
    name: string;
    color: string;
    avatarPath: string | null;
    avatarPosition: string | null;
  } | null;
};

export type CatalogSuggestion = {
  id: string;
  name: string;
  icon: string;
  defaultStoreId: string | null;
};

export type GroceriesData = {
  stores: StoreView[];
  items: ShoppingItemView[];
  catalog: CatalogSuggestion[];
};

/**
 * Everything the grocery page needs: the stores to shop, the lines currently
 * needed, and the remembered catalog. The catalog is returned whole (ordered
 * by how often each thing has been added) so the client can both show the
 * most common items as one-tap chips and offer the rest as you type. A line on
 * the list is always "needed" — checking it off while shopping deletes it, so
 * there is no bought/unbought state to carry here.
 */
export async function loadGroceries(): Promise<GroceriesData> {
  const [stores, items, catalog] = await Promise.all([
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, icon: true },
    }),
    prisma.shoppingItem.findMany({
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        icon: true,
        storeId: true,
        note: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            color: true,
            avatarPath: true,
            avatarPosition: true,
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
  ]);

  return {
    stores,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      icon: i.icon,
      storeId: i.storeId,
      note: i.note,
      assignee: i.assignedTo,
    })),
    catalog,
  };
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

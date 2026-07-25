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
  bought: boolean;
  assignee: { id: string; name: string; color: string; avatarPath: string | null } | null;
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
  suggestions: CatalogSuggestion[];
};

/**
 * Everything the grocery board needs: the stores to filter by, the lines
 * currently on the list, and the most-used catalog items to offer as quick
 * picks. Suggestions are ordered by how often they've been bought, which is
 * how the list "learns" what's common.
 */
export async function loadGroceries(): Promise<GroceriesData> {
  const [stores, items, suggestions] = await Promise.all([
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, icon: true },
    }),
    prisma.shoppingItem.findMany({
      orderBy: [{ boughtAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        icon: true,
        storeId: true,
        note: true,
        boughtAt: true,
        assignedTo: {
          select: { id: true, name: true, color: true, avatarPath: true },
        },
      },
    }),
    prisma.groceryItem.findMany({
      where: { isActive: true },
      orderBy: [{ useCount: "desc" }, { lastUsedAt: "desc" }, { name: "asc" }],
      take: 24,
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
      bought: i.boughtAt !== null,
      assignee: i.assignedTo,
    })),
    suggestions,
  };
}

export type AdminStore = {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
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
  const [stores, catalog] = await Promise.all([
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
  ]);
  return { stores, catalog };
}

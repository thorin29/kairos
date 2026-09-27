import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addBookCore } from "@/lib/books-core";
import { addItemCore, addFromCatalogCore } from "@/lib/groceries-core";
import { addMoneyEntryCore } from "@/lib/money-core";
import { addTaskCore } from "@/lib/task-core";
import { addSchoolWorkCore } from "@/lib/school-core";
import { createPersonalEvent } from "@/lib/calendar/create-event";
import { createRecurringTask } from "@/lib/tasks/recurring";

/**
 * Locks in the offline-create idempotency contract across every create path:
 * the same clientId, sent twice (the "DB committed, HTTP response lost, client
 * retries" failure), must resolve to the single existing row — never a second
 * one. Manual testing can't reliably reproduce that window; this can.
 */

async function resetDb(): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
  }
}

const seedUser = () => prisma.user.create({ data: { name: "Tester" } });
const seedStore = () => prisma.store.create({ data: { name: "Test Store" } });

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("offline-create idempotency: same clientId twice -> one row", () => {
  it("book", async () => {
    const u = await seedUser();
    const cid = "cid-book";
    const a = await addBookCore({ userId: u.id, title: "Dune", pages: 400, clientId: cid });
    const b = await addBookCore({ userId: u.id, title: "Dune", pages: 400, clientId: cid });
    expect(a.ok && b.ok).toBe(true);
    expect(a.ok && a.id).toBe(b.ok && b.id);
    expect(await prisma.book.count()).toBe(1);
  });

  it("grocery normal add", async () => {
    const u = await seedUser();
    const s = await seedStore();
    const cid = "cid-grocery";
    const a = await addItemCore({ name: "Milk", storeId: s.id, requesterId: u.id, clientId: cid });
    const b = await addItemCore({ name: "Milk", storeId: s.id, requesterId: u.id, clientId: cid });
    expect(a).toBe(b);
    expect(await prisma.shoppingItem.count()).toBe(1);
  });

  it("grocery catalog add", async () => {
    const s = await seedStore();
    const g = await prisma.groceryItem.create({ data: { name: "Eggs", defaultStoreId: s.id } });
    const cid = "cid-catalog";
    const a = await addFromCatalogCore(g.id, s.id, null, cid);
    const b = await addFromCatalogCore(g.id, s.id, null, cid);
    expect(a).toBe(b);
    expect(await prisma.shoppingItem.count()).toBe(1);
  });

  it("money entry", async () => {
    const u = await seedUser();
    const cid = "cid-money";
    const a = await addMoneyEntryCore({ userId: u.id, direction: "PAYMENT", amountCents: 500, detail: "Snacks", clientId: cid });
    const b = await addMoneyEntryCore({ userId: u.id, direction: "PAYMENT", amountCents: 500, detail: "Snacks", clientId: cid });
    expect(a.ok && b.ok).toBe(true);
    expect(a.ok && a.id).toBe(b.ok && b.id);
    expect(await prisma.moneyEntry.count()).toBe(1);
  });

  it("task", async () => {
    const u = await seedUser();
    const cid = "cid-task";
    const a = await addTaskCore({ userId: u.id, title: "Homework", clientId: cid });
    const b = await addTaskCore({ userId: u.id, title: "Homework", clientId: cid });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.id).toBe(b.id);
    expect(await prisma.task.count()).toBe(1);
  });

  it("school work", async () => {
    const u = await seedUser();
    const cid = "cid-school";
    const a = await addSchoolWorkCore({ userId: u.id, title: "Book report", type: "ASSIGNMENT", dueDate: "2026-10-10", clientId: cid });
    const b = await addSchoolWorkCore({ userId: u.id, title: "Book report", type: "ASSIGNMENT", dueDate: "2026-10-10", clientId: cid });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.id).toBe(b.id);
    expect(await prisma.task.count()).toBe(1);
  });

  it("calendar event -> same Event id, one Event", async () => {
    const u = await seedUser();
    const cid = "cid-event";
    const input = { title: "Dentist", allDay: true, date: "2026-10-01", clientId: cid };
    const a = await createPersonalEvent(u.id, input, true);
    const b = await createPersonalEvent(u.id, input, true);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.id).toBe(b.id);
    expect(await prisma.event.count()).toBe(1);
  });

  it("recurring task -> one RecurringTask template", async () => {
    const u = await seedUser();
    const cid = "cid-recurring";
    const input = {
      userId: u.id,
      title: "Trash day",
      freq: "WEEKLY",
      interval: 1,
      byday: ["MO"],
      startDate: "2026-10-05",
      endMode: "NEVER",
      maxCount: null,
      until: "",
      clientId: cid,
    };
    const a = await createRecurringTask(input);
    const b = await createRecurringTask(input);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    // One create fans out to many Task rows, so there is no single id to return;
    // the guarantee is simply that the series template is not duplicated.
    expect(await prisma.recurringTask.count()).toBe(1);
  });
});

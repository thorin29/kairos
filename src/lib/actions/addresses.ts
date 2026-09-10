"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { normalizeAddress, normalizeName } from "@/lib/addresses";
import { loadAddressPicker, type PickerAddress } from "@/lib/queries/addresses";

function bust() {
  revalidatePath("/admin/addresses");
  revalidatePath("/calendar");
}

export type AddressInput = { name: string; address: string; category: string };

export type CreateAddressResult =
  | { ok: true; id: string }
  | { ok: false; duplicate: { id: string; name: string; address: string } };

function clean(input: AddressInput) {
  const name = input.name.trim();
  const address = input.address.trim();
  const category = input.category.trim() || "General";
  if (!name || !address) throw new Error("A name and an address are both required.");
  return { name, address, category };
}

/** Near-duplicate by normalized address or name; null if none. */
async function findDuplicate(
  name: string,
  address: string,
): Promise<{ id: string; name: string; address: string } | null> {
  const na = normalizeAddress(address);
  const nn = normalizeName(name);
  const existing = (await prisma.savedAddress.findMany({
    select: { id: true, name: true, address: true },
  })) as { id: string; name: string; address: string }[];
  return (
    existing.find(
      (e) => normalizeAddress(e.address) === na || normalizeName(e.name) === nn,
    ) ?? null
  );
}

async function create(
  input: AddressInput,
  force: boolean,
  submittedById: string | null,
): Promise<CreateAddressResult> {
  const { name, address, category } = clean(input);
  if (!force) {
    const dup = await findDuplicate(name, address);
    if (dup) return { ok: false, duplicate: dup };
  }
  const created = await prisma.savedAddress.create({
    data: { name, address, category, status: "APPROVED", submittedById },
    select: { id: true },
  });
  bust();
  return { ok: true, id: created.id as string };
}

/** Admin intake (Admin → Addresses). */
export async function createSavedAddress(
  input: AddressInput,
  force = false,
): Promise<CreateAddressResult> {
  await requireAdmin();
  return create(input, force, null);
}

export async function updateSavedAddress(id: string, input: AddressInput): Promise<void> {
  await requireAdmin();
  const { name, address, category } = clean(input);
  await prisma.savedAddress.update({ where: { id }, data: { name, address, category } });
  bust();
}

export async function deleteSavedAddress(id: string): Promise<void> {
  await requireAdmin();
  await prisma.savedAddress.delete({ where: { id } });
  bust();
}

/** Approved addresses + category options, for the calendar location combobox. */
export async function listSavedAddresses(): Promise<{
  addresses: PickerAddress[];
  categories: string[];
}> {
  await requireInteractive();
  return loadAddressPicker();
}

/**
 * Save a new address typed on an event's location field. Interactive session
 * (whoever can add an event), so it lands APPROVED straight away — same as the
 * admin intake. Returns a near-duplicate for a "did you mean?" confirm unless
 * forced.
 */
export async function saveAddressFromCalendar(
  input: AddressInput,
  force = false,
): Promise<CreateAddressResult> {
  await requireInteractive();
  return create(input, force, null);
}

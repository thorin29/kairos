"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { cleanAddress, saveAddress, type SaveResult } from "@/lib/addresses-core";
import { loadAddressPicker, type PickerAddress } from "@/lib/queries/addresses";

function bust() {
  revalidatePath("/admin/addresses");
  revalidatePath("/calendar");
}

export type AddressInput = { name: string; address: string };
export type CreateAddressResult = SaveResult;

/** Admin intake (Admin → Addresses) — lands APPROVED. */
export async function createSavedAddress(
  input: AddressInput,
  force = false,
): Promise<CreateAddressResult> {
  await requireAdmin();
  const res = await saveAddress(input, { force, status: "APPROVED", submittedById: null });
  if (res.ok) bust();
  return res;
}

export async function updateSavedAddress(id: string, input: AddressInput): Promise<void> {
  await requireAdmin();
  const { name, address } = cleanAddress(input);
  await prisma.savedAddress.update({ where: { id }, data: { name, address } });
  bust();
}

export async function deleteSavedAddress(id: string): Promise<void> {
  await requireAdmin();
  await prisma.savedAddress.delete({ where: { id } });
  bust();
}

/** Approve a phone-submitted (PENDING) address into the shared book. */
export async function approveSavedAddress(id: string): Promise<void> {
  await requireAdmin();
  await prisma.savedAddress.update({ where: { id }, data: { status: "APPROVED" } });
  bust();
}

/** Approved addresses for the calendar location combobox. */
export async function listSavedAddresses(): Promise<{ addresses: PickerAddress[] }> {
  await requireInteractive();
  return loadAddressPicker();
}

/** Save a new address typed on an event's location field (web) — lands APPROVED. */
export async function saveAddressFromCalendar(
  input: AddressInput,
  force = false,
): Promise<CreateAddressResult> {
  await requireInteractive();
  const res = await saveAddress(input, { force, status: "APPROVED", submittedById: null });
  if (res.ok) bust();
  return res;
}

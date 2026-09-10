"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { normalizeAddress, normalizeName } from "@/lib/addresses";

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

/**
 * Create a saved address. Unless `force` is set, first checks for a near-duplicate
 * (same normalized address or name) and, if found, returns it instead of writing,
 * so the caller can ask "did you mean this?" before saving a second copy.
 */
export async function createSavedAddress(
  input: AddressInput,
  force = false,
): Promise<CreateAddressResult> {
  await requireAdmin();
  const { name, address, category } = clean(input);

  if (!force) {
    const na = normalizeAddress(address);
    const nn = normalizeName(name);
    const existing = (await prisma.savedAddress.findMany({
      select: { id: true, name: true, address: true },
    })) as { id: string; name: string; address: string }[];
    const dup = existing.find(
      (e) => normalizeAddress(e.address) === na || normalizeName(e.name) === nn,
    );
    if (dup) return { ok: false, duplicate: dup };
  }

  const created = await prisma.savedAddress.create({
    data: { name, address, category, status: "APPROVED" },
    select: { id: true },
  });
  bust();
  return { ok: true, id: created.id as string };
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

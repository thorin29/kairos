import { prisma } from "@/lib/prisma";
import { normalizeAddress, normalizeName } from "@/lib/addresses";

export type AddressFields = { name: string; address: string; navByName?: boolean };
export type Duplicate = { id: string; name: string; address: string };
export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; duplicate: Duplicate };

export function cleanAddress(input: AddressFields): { name: string; address: string; navByName: boolean } {
  const name = input.name.trim();
  const address = input.address.trim();
  if (!name || !address) throw new Error("A name and an address are both required.");
  return { name, address, navByName: input.navByName ?? true };
}

/** Near-duplicate by normalized address or name, across the whole book; null if none. */
export async function findDuplicate(
  name: string,
  address: string,
): Promise<Duplicate | null> {
  const na = normalizeAddress(address);
  const nn = normalizeName(name);
  const existing = (await prisma.savedAddress.findMany({
    select: { id: true, name: true, address: true },
  })) as Duplicate[];
  return (
    existing.find(
      (e) => normalizeAddress(e.address) === na || normalizeName(e.name) === nn,
    ) ?? null
  );
}

/**
 * Create one saved address. Returns a near-duplicate (unless `force`) so the
 * caller can offer "did you mean?". `status` is APPROVED for trusted entries
 * (admin intake, web calendar, a parent/admin phone) and PENDING for a member's
 * phone submission awaiting approval.
 */
export async function saveAddress(
  input: AddressFields,
  opts: { force: boolean; status: "APPROVED" | "PENDING"; submittedById: string | null },
): Promise<SaveResult> {
  const { name, address, navByName } = cleanAddress(input);
  if (!opts.force) {
    const dup = await findDuplicate(name, address);
    if (dup) return { ok: false, duplicate: dup };
  }
  const created = await prisma.savedAddress.create({
    data: { name, address, navByName, status: opts.status, submittedById: opts.submittedById },
    select: { id: true },
  });
  return { ok: true, id: created.id as string };
}

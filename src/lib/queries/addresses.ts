import { prisma } from "@/lib/prisma";

export type AdminAddress = {
  id: string;
  name: string;
  address: string;
  navByName: boolean;
  status: "APPROVED" | "PENDING";
  submittedBy: string | null;
};

export type PickerAddress = {
  id: string;
  name: string;
  address: string;
  navByName: boolean;
};

/** The whole book (all statuses) for the admin screen. */
export async function loadAddressAdmin(): Promise<{ addresses: AdminAddress[] }> {
  const rows = await prisma.savedAddress.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true, name: true, address: true, navByName: true, status: true,
      submittedBy: { select: { name: true } },
    },
  });
  const addresses = (rows as { id: string; name: string; address: string; navByName: boolean; status: "APPROVED" | "PENDING"; submittedBy: { name: string } | null }[]).map(
    (r) => ({
      id: r.id, name: r.name, address: r.address, navByName: r.navByName,
      status: r.status, submittedBy: r.submittedBy?.name ?? null,
    }),
  );
  return { addresses };
}

/** Approved addresses only, for the calendar location picker. */
export async function loadAddressPicker(): Promise<{ addresses: PickerAddress[] }> {
  const rows = await prisma.savedAddress.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, address: true, navByName: true },
  });
  return { addresses: rows as PickerAddress[] };
}

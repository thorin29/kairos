"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPin } from "@/lib/auth";
import { nextColor } from "@/lib/palette";
import { isAdmin, requireAdmin } from "@/lib/session";

export type ActionState = { error: string | null };

function cleanName(raw: FormDataEntryValue | null): string {
  return String(raw ?? "").trim().slice(0, 40);
}

export async function addPerson(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // First run has no accounts, so nobody can be signed in yet. Once anyone
  // exists, adding people is a parent action.
  const anyone = await prisma.user.count();
  if (anyone > 0 && !(await isAdmin())) {
    return { error: "Only a parent can change this. Switch profiles first." };
  }

  const name = cleanName(formData.get("name"));
  const role = formData.get("role") === "ADMIN" ? Role.ADMIN : Role.MEMBER;
  const pin = String(formData.get("pin") ?? "").trim();

  if (name.length < 2) {
    return { error: "Enter a name with at least two characters." };
  }

  if (role === Role.ADMIN && !/^\d{4,8}$/.test(pin)) {
    return { error: "Parents need a PIN of 4 to 8 digits." };
  }

  const existing = await prisma.user.findFirst({ where: { name } });
  if (existing) {
    return { error: `${name} is already on the list.` };
  }

  const others = await prisma.user.findMany({ select: { color: true } });

  await prisma.user.create({
    data: {
      name,
      role,
      pinHash: pin ? hashPin(pin) : null,
      color: nextColor(others.map((o) => o.color)),
      sortOrder: others.length,
    },
  });

  revalidatePath("/setup");
  revalidatePath("/");
  return { error: null };
}

export async function removePerson(id: string): Promise<void> {
  await requireAdmin();

  await prisma.user.delete({ where: { id } });
  revalidatePath("/setup");
  revalidatePath("/");
}

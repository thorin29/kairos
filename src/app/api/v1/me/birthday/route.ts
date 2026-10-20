import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";
import { checkBirthday } from "@/lib/birthday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The enrolled person's birthday (YYYY-MM-DD, or null when not set). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const row = (await prisma.user.findUnique({
    where: { id: authed.device.person.id },
    select: { birthday: true },
  })) as { birthday: Date | null } | null;
  return apiOk({ birthday: row?.birthday ? fromDateColumn(row.birthday) : null });
}

/**
 * Set (or clear, with null or "") the enrolled person's birthday from their
 * phone — the same field the web profile edits, so it shows on the calendar
 * every year. Same rule as the web: a real date, 1900 on, not in the future.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const raw = (body as Record<string, unknown> | null)?.birthday;
  const checked = checkBirthday(typeof raw === "string" ? raw : "", todayISO());
  if (!checked.ok) return apiError("validation", checked.error);

  const id = authed.device.person.id;
  await prisma.user.update({
    where: { id },
    data: { birthday: checked.value ? toDateColumn(checked.value) : null },
  });

  revalidatePath("/", "layout");
  revalidatePath(`/person/${id}`);
  revalidatePath(`/person/${id}/profile`);
  revalidatePath("/calendar");
  return apiOk({ birthday: checked.value });
}

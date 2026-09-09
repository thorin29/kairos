import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Set the enrolled person's colour from their device. This is the same
 * `user.color` the web profile edits, so it flows to the calendar, avatar ring,
 * and everywhere the person's colour is shown.
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
  const raw = body as Record<string, unknown> | null;
  const color = typeof raw?.color === "string" ? raw.color.trim() : "";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return apiError("validation", "Pick a valid colour.");
  }

  const id = authed.device.person.id;
  await prisma.user.update({ where: { id }, data: { color } });

  revalidatePath("/", "layout");
  revalidatePath(`/person/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/setup");
  return apiOk({ color });
}

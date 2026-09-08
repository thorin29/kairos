import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { removeItemCore } from "@/lib/groceries-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Remove a line from the shared list (also "got it" from a cart).
 * A person may only remove items they added; parents (kind PARENT) and admins
 * (role ADMIN) may remove anything. (The web board keeps its own rules.)
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return apiError("validation", "id is required.");

  const item = await prisma.shoppingItem.findUnique({
    where: { id },
    select: { assignedToId: true },
  });
  if (!item) return apiOk({ status: "ok" }); // already gone

  const privileged = me.role === "ADMIN" || me.kind === "PARENT";
  const mine = item.assignedToId != null && item.assignedToId === me.id;
  if (!privileged && !mine) {
    return apiError("forbidden", "You can only remove items you added.");
  }

  await removeItemCore(id);
  return apiOk({ status: "ok" });
}

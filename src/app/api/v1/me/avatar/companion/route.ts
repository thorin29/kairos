import type { NextRequest } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice, personPayloadById } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { companionAvatarValue, isUploaded } from "@/lib/avatars";
import { loadOwnedCompanions } from "@/lib/companions-owned";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADS = path.join(process.env.DATA_DIR || "/app/data", "uploads");

/**
 * Use one of your own companions, at a stage you have reached, as your profile
 * picture. Phone only by design — the web shows it but has no picker.
 *
 * Body: { "species": "coincroc", "stage": 0 | 1 | 2 }. Ownership and the stage
 * reached come from loadOwnedCompanions — the same rule the gallery shows — so
 * a stage the gallery offers is exactly one this accepts. Self only.
 * Replacing an uploaded photo deletes the file, as uploading a new one does.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const id = authed.device.person.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const raw = body as { species?: unknown; stage?: unknown } | null;
  const species = typeof raw?.species === "string" ? raw.species : "";
  const stage = typeof raw?.stage === "number" ? raw.stage : -1;
  if (!species) return apiError("validation", "species is required.");
  if (!Number.isInteger(stage) || stage < 0 || stage > 2) {
    return apiError("validation", "stage must be 0, 1 or 2.");
  }

  const mine = await loadOwnedCompanions(id);
  const owned = mine.find((c) => c.species === species);
  if (!owned) return apiError("validation", "You don't have that companion.");
  if (stage > owned.stage) {
    return apiError("validation", "You haven't raised it to that stage yet.");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { avatarPath: true },
  });
  if (!user) return apiError("validation", "That person no longer exists.");
  const oldFile = isUploaded(user.avatarPath) ? user.avatarPath : null;

  await prisma.user.update({
    where: { id },
    data: { avatarPath: companionAvatarValue(species, stage), avatarPosition: "0 0 1" },
  });
  if (oldFile) await unlink(path.join(UPLOADS, oldFile)).catch(() => {});

  revalidatePath("/", "layout");
  revalidatePath(`/person/${id}`);
  revalidatePath(`/person/${id}/profile`);
  revalidatePath("/setup");
  return apiOk({ person: await personPayloadById(id) });
}

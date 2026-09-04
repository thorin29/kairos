import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addSlotCore } from "@/lib/workouts/rotation-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as {
    name?: string; category?: string | null; muscleGroup?: string | null; isRest?: boolean;
  } | null;
  await addSlotCore(authed.device.person.id, {
    name: b?.name ?? "",
    category: b?.category ?? null,
    muscleGroup: b?.muscleGroup ?? null,
    isRest: b?.isRest ?? false,
  });
  return apiOk({ status: "ok" });
}

import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { bookOwnerId, logBookCore } from "@/lib/books-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set the page/chapter you're up to for one of your books. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return apiError("validation", "id is required.");
  if ((await bookOwnerId(id)) !== authed.device.person.id) {
    return apiError("forbidden", "That isn't your book.");
  }
  const raw = body.page ?? body.amount;
  const page = typeof raw === "number" ? raw : Number(raw);
  await logBookCore(id, Number.isFinite(page) ? page : 0);
  return apiOk({ status: "ok" });
}

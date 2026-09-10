import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadAddressPicker } from "@/lib/queries/addresses";
import { saveAddress } from "@/lib/addresses-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The approved saved-address book, for the app's location picker. Shared
 *  family data — any enrolled device may read it. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const data = await loadAddressPicker();
  return apiOk(data);
}

/**
 * Submit a new address from a phone. A parent/admin's submission is trusted and
 * lands APPROVED; anyone else's lands PENDING for admin approval. Returns a
 * near-duplicate (unless `force`) so the app can offer "did you mean?".
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;

  let body: { name?: string; address?: string; navByName?: boolean; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }

  const name = String(body.name ?? "").trim();
  const address = String(body.address ?? "").trim();
  if (!name || !address) {
    return apiError("validation", "A name and an address are both required.");
  }
  const trusted = me.kind === "PARENT" || me.role === "ADMIN";

  const res = await saveAddress(
    { name, address, navByName: body.navByName ?? true },
    { force: !!body.force, status: trusted ? "APPROVED" : "PENDING", submittedById: me.id },
  );

  if (!res.ok) {
    return apiOk({ ok: false, duplicate: res.duplicate });
  }
  revalidatePath("/admin/addresses");
  return apiOk({ ok: true, id: res.id, status: trusted ? "APPROVED" : "PENDING" });
}

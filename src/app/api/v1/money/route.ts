import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadMoneyApi } from "@/lib/queries/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The enrolled person's Money surface (mirrors the web /money page): the people
 * they may see with running balances, the selected person's ledger newest-first,
 * the add-picker roster, frequent-payment quick-picks, and — for an admin device
 * — the outstanding Bible-reward months to approve. `?user=<id>` selects whose
 * ledger to return; it falls back to the first participant.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const user = req.nextUrl.searchParams.get("user") ?? undefined;
  const data = await loadMoneyApi(authed.device.person, user);
  return apiOk(data);
}

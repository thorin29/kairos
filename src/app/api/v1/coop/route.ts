import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadCoop } from "@/lib/queries/coop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The family co-op goal for the current season, from this device's viewpoint
 *  (which proposals it has voted for, whether it can run admin actions). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;
  const isAdmin = me.role === "ADMIN" || me.kind === "PARENT";

  const data = await loadCoop();
  return apiOk({
    seasonLabel: data.seasonLabel,
    floor: data.floor,
    childrenMeeting: data.childrenMeeting,
    childrenTotal: data.childrenTotal,
    gateMet: data.gateMet,
    meId: me.id,
    isAdmin,
    children: data.children.map((c) => ({
      name: c.name,
      color: c.color,
      tier: c.tier,
      meets: c.meets,
    })),
    proposals: data.proposals.map((p) => ({
      id: p.id,
      title: p.title,
      detail: p.detail,
      proposedByName: p.proposedByName,
      status: p.status,
      votes: p.votes,
      iVoted: p.voterIds.includes(me.id),
    })),
  });
}

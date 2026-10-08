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
    target: data.target,
    familyPct: data.familyPct,
    childrenMeeting: data.childrenMeeting,
    childrenTotal: data.childrenTotal,
    gateMet: data.gateMet,
    meId: me.id,
    isAdmin,
    children: data.children.map((c) => ({
      name: c.name,
      color: c.color,
      tier: c.tier,
      cleanDays: c.cleanDays,
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
    // A goal picked in an earlier window and never checked off. Appended at the
    // END and nullable, so an app build that predates it decodes and ignores it
    // rather than failing. Carries its own month label and its own gate,
    // because it is judged on the month it belonged to.
    carried: data.carried
      ? {
          id: data.carried.id,
          title: data.carried.title,
          detail: data.carried.detail,
          seasonLabel: data.carried.seasonLabel,
          gateMet: data.carried.gateMet,
          childrenMeeting: data.carried.childrenMeeting,
        }
      : null,
  });
}

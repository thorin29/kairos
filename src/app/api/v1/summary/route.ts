import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadProgression } from "@/lib/queries/progression";
import { loadCoop } from "@/lib/queries/coop";
import { addDays, addMonths, startOfMonth, startOfWeek, todayISO } from "@/lib/dates";
import { currentSeasonWindow } from "@/lib/season";
import { completionFilter, completionPeople, loadCompletion } from "@/lib/queries/completion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Summary (v0.733): the family goal and the completion grid. A parent's phone
 * gets everyone, a child's only themselves. `view` week|month, `at` any day in
 * the range (default today), `f` all|chores|bible|school|workouts.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const q = req.nextUrl.searchParams;
  const today = todayISO();
  const view = q.get("view") === "month" ? "month" : "week";
  const atRaw = q.get("at") ?? "";
  const at = /^\d{4}-\d{2}-\d{2}$/.test(atRaw) ? atRaw : today;
  const filter = completionFilter(q.get("f"));
  const from = view === "month" ? startOfMonth(at) : startOfWeek(at);
  const to = view === "month" ? addDays(addMonths(from, 1), -1) : addDays(from, 6);

  const me = authed.device.person;
  const [people, all, season] = await Promise.all([
    completionPeople({ id: me.id, kind: me.kind }),
    loadProgression(),
    currentSeasonWindow(today),
  ]);
  const [rows, coop] = await Promise.all([loadCompletion(people, from, to, filter), loadCoop(all)]);

  return apiOk({
    seasonName: season.label,
    familyGoal: {
      text: coop.granted
        ? `Earned: ${coop.granted.title}`
        : coop.selected
          ? `Working toward: ${coop.selected.title}`
          : "Propose and vote on a family reward",
      kids: coop.childrenTotal > 0 ? `${coop.childrenMeeting}/${coop.childrenTotal} kids` : null,
    },
    view,
    from,
    to,
    today,
    filter,
    rows,
  });
}

import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import {
  loadSchoolAdmin,
  loadSchoolStructure,
  loadSchoolMetrics,
  loadClassOptions,
  type ClassRow,
} from "@/lib/queries/school";
import { SCHOOL_TYPE_LABEL, SCHOOL_TYPES } from "@/lib/school";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The signed-in person's School view, role-scoped like the web: a child sees
 * only their own; a parent sees themselves plus every child. Whether you can
 * add/complete for someone else is separate (admins/self only) and returned as
 * `canActFor`.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;

  // Visibility: parents see their kids too.
  let visible: string[] = [me.id];
  if (me.kind === "PARENT") {
    const kids = await prisma.user.findMany({
      where: { isActive: true, kind: "CHILD" },
      select: { id: true },
    });
    visible = [me.id, ...kids.map((k) => k.id)];
  }
  const visibleSet = new Set(visible);
  const canAct = me.role === "ADMIN"; // admins can act for anyone visible; else self only

  const today = todayISO();
  const [people, structure] = await Promise.all([loadSchoolAdmin(), loadSchoolStructure()]);
  const classOptions = await loadClassOptions();
  const terms = structure.terms;

  const rawTerm = req.nextUrl.searchParams.get("term");
  const current = terms.find((t) => t.startISO <= today && today <= t.endISO) ?? null;
  const selected =
    rawTerm === "all"
      ? null
      : rawTerm
        ? (terms.find((t) => t.id === rawTerm) ?? null)
        : current;
  const metrics = await loadSchoolMetrics(
    selected ? { startISO: selected.startISO, endISO: selected.endISO } : null,
  );
  const statsByUser = new Map(metrics.map((m) => [m.userId, m]));

  // Classes show under the owner and anyone the class is shared with.
  const classesByPerson = new Map<string, ClassRow[]>();
  for (const p of structure.people) classesByPerson.set(p.id, []);
  for (const p of structure.people) {
    for (const c of p.classes) {
      classesByPerson.get(p.id)?.push(c);
      for (const uid of c.sharedWith) classesByPerson.get(uid)?.push(c);
    }
  }

  const shownPeople = people.filter((p) => visibleSet.has(p.id));
  const actForIds = canAct ? visible : [me.id];

  return apiOk({
    seasonHint: selected ? selected.name : "All time",
    terms: terms.map((t) => ({ id: t.id, name: t.name })),
    selectedTermId: selected ? selected.id : null,
    subjects: structure.subjects.map((s) => s.name),
    types: SCHOOL_TYPES.map((t) => ({ key: t, label: SCHOOL_TYPE_LABEL[t] })),
    canActFor: shownPeople
      .filter((p) => actForIds.includes(p.id))
      .map((p) => ({ id: p.id, name: p.name })),
    classOptionsByUser: Object.fromEntries(
      actForIds.map((uid) => [uid, classOptions[uid] ?? []]),
    ),
    people: shownPeople.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      pending: p.pending,
      overdue: p.overdue,
      classes: (classesByPerson.get(p.id) ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        meeting: c.meeting,
      })),
      items: p.items.map((it) => ({
        id: it.id,
        title: it.title,
        type: it.type,
        typeLabel: SCHOOL_TYPE_LABEL[it.type],
        className: it.className,
        classColor: it.classColor,
        dueISO: it.dueISO,
        overdue: it.overdue,
      })),
    })),
    progress: structure.people
      .filter((p) => visibleSet.has(p.id))
      .map((p) => {
        const s = statsByUser.get(p.id);
        if (!s || s.total === 0) return null;
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          pct: Math.round((s.completed / s.total) * 100),
          completed: s.completed,
          total: s.total,
          onTime: s.onTime,
          overdue: s.overdue,
          byClass: s.byClass.map((c) => ({ key: c.key, color: c.color, completed: c.completed, total: c.total })),
        };
      })
      .filter((x) => x != null),
  });
}

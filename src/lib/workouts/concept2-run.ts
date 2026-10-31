import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting, clearSetting } from "@/lib/settings";
import { addDays, dayOfWeek, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";
import { settleWorkoutTask } from "@/lib/workouts/mark";
import {
  C2_ACCEPT,
  C2_BASE,
  MAX_BACK_DAYS,
  cleanToken,
  mapResult,
  rowNotes,
  rowSummary,
  syncDue,
  syncFrom,
  type C2Raw,
  type C2Row,
} from "@/lib/workouts/concept2";

/**
 * Concept2 Logbook sync. Each person pastes their own long-lived token from
 * the Logbook (Edit Profile → Applications); it's kept in a setting and never
 * sent back to any client. Results are only read.
 *
 * A rower result becomes a Rowing session on its day, named after that day's
 * planned rowing (so the Cardio block counts done) or "Rowing" as an extra.
 * When the day already had rowing entered by hand and no Concept2 row yet, the
 * first Concept2 row replaces it; Undo puts the hand entry back and keeps that
 * result out.
 */

const tokenKey = (userId: string) => `concept2.token.${userId}`;
const syncKey = (userId: string) => `concept2.sync.${userId}`;

type SyncMeta = { at: string | null; error: string | null };

async function readMeta(userId: string): Promise<SyncMeta> {
  try {
    const m = JSON.parse((await getSetting(syncKey(userId))) ?? "{}") as Partial<SyncMeta>;
    return { at: typeof m.at === "string" ? m.at : null, error: typeof m.error === "string" ? m.error : null };
  } catch {
    return { at: null, error: null };
  }
}

const writeMeta = (userId: string, m: SyncMeta) => setSetting(syncKey(userId), JSON.stringify(m));

export type Concept2Row = {
  resultId: string;
  summary: string;
  /** It replaced rowing entered by hand: Undo puts that back. */
  replaced: string | null;
};

export type Concept2Status = {
  connected: boolean;
  /** When it last checked (ISO), and why the last check failed. */
  checkedAt: string | null;
  error: string | null;
};

export type Concept2Day = Concept2Status & { rows: Concept2Row[] };

export async function concept2Status(userId: string): Promise<Concept2Status> {
  const [token, meta] = await Promise.all([getSetting(tokenKey(userId)), readMeta(userId)]);
  return { connected: !!token, checkedAt: meta.at, error: token ? meta.error : null };
}

async function c2Get(token: string, path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${C2_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: C2_ACCEPT },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const TURNED_DOWN = "Concept2 turned down the token. Connect again with a new one.";

/** Check the token with Concept2, then keep it. */
export async function connectConcept2(userId: string, raw: string): Promise<{ ok: true } | { error: string }> {
  const token = cleanToken(raw);
  if (!token) return { error: "That doesn't look like a Concept2 token." };
  try {
    const r = await c2Get(token, "/api/users/me");
    if (r.status === 401 || r.status === 403) return { error: "Concept2 turned down that token." };
    if (r.status !== 200) return { error: `Concept2 didn't answer (${r.status}). Try again.` };
  } catch {
    return { error: "Couldn't reach Concept2. Try again." };
  }
  await setSetting(tokenKey(userId), token);
  await writeMeta(userId, { at: null, error: null });
  return { ok: true };
}

/** Forget the token. Rows already taken stay. */
export async function disconnectConcept2(userId: string): Promise<void> {
  await clearSetting(tokenKey(userId));
  await clearSetting(syncKey(userId));
}

async function fetchRows(token: string, from: string): Promise<C2Row[]> {
  const rows: C2Row[] = [];
  for (let page = 1; page <= 5; page++) {
    const r = await c2Get(
      token,
      `/api/users/me/results?type=rower&updated_after=${from}&number=250&page=${page}`,
    );
    if (r.status === 401 || r.status === 403) throw new Error("token");
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const body = r.body as { data?: C2Raw[]; meta?: { pagination?: { total_pages?: number } } } | null;
    for (const raw of body?.data ?? []) {
      const row = mapResult(raw);
      if (row) rows.push(row);
    }
    const pages = body?.meta?.pagination?.total_pages ?? 1;
    if (page >= pages) break;
  }
  return rows;
}

/** The name a row takes on its day: the planned rowing's, else "Rowing". */
async function rowName(userId: string, dateISO: string): Promise<string> {
  const plan = (await prisma.plannedWorkout.findFirst({
    where: {
      userId,
      dayOfWeek: dayOfWeek(dateISO),
      isRest: false,
      category: "ROWING",
      createdAt: { lt: toDateColumn(addDays(dateISO, 1)) },
    },
    orderBy: { sortOrder: "asc" },
    select: { name: true },
  })) as { name: string } | null;
  return plan?.name.slice(0, 60) || "Rowing";
}

type HandSnapshot = {
  name: string | null;
  notes: string | null;
  completedOn: string | null;
  intent: string | null;
  sets: {
    setNumber: number;
    meters: number | null;
    seconds: number | null;
    distance: number | null;
    unit: string | null;
  }[];
};

/** Take one row: a session (replacing a hand entry when it's the day's first). */
async function takeRow(userId: string, row: C2Row, name: string): Promise<void> {
  const date = toDateColumn(row.dateISO);
  const already = (await prisma.concept2Result.findMany({
    where: { userId, date, dismissed: false, sessionId: { not: null } },
    select: { sessionId: true },
  })) as { sessionId: string | null }[];
  const live = (await prisma.workoutSession.count({
    where: { id: { in: already.map((a) => a.sessionId as string) } },
  })) as number;

  let replaced: HandSnapshot | null = null;
  if (live === 0) {
    const hand = (await prisma.workoutSession.findFirst({
      where: { userId, date, isRest: false, category: "ROWING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        notes: true,
        completedOn: true,
        intent: true,
        sets: {
          orderBy: { setNumber: "asc" },
          select: { setNumber: true, meters: true, seconds: true, distance: true, unit: true },
        },
      },
    })) as {
      id: string;
      name: string | null;
      notes: string | null;
      completedOn: Date | null;
      intent: string | null;
      sets: HandSnapshot["sets"];
    } | null;
    if (hand) {
      replaced = {
        name: hand.name,
        notes: hand.notes,
        completedOn: hand.completedOn ? fromDateColumn(hand.completedOn) : null,
        intent: hand.intent,
        sets: hand.sets,
      };
      await prisma.workoutSession.delete({ where: { id: hand.id } });
    }
  }

  const session = await prisma.workoutSession.create({
    data: {
      userId,
      date,
      name,
      category: "ROWING",
      finished: true,
      isRest: false,
      notes: rowNotes(row),
      sets: {
        create: [
          {
            setNumber: 1,
            meters: row.meters || null,
            seconds: row.seconds || null,
            unit: "m",
            finished: true,
          },
        ],
      },
    },
    select: { id: true },
  });
  await prisma.concept2Result.create({
    data: {
      userId,
      resultId: row.resultId,
      date,
      meters: row.meters,
      seconds: row.seconds,
      sessionId: session.id,
      dismissed: false,
      replaced: (replaced ?? undefined) as never,
    },
  });
  await settleWorkoutTask(userId, row.dateISO, { fallbackComplete: true });
}

/**
 * Check Concept2 for new rows. Opening the day page asks at most every few
 * minutes; `force` ("Check now") always asks. Never throws: a failure is kept
 * as the status's error.
 */
export async function syncConcept2(userId: string, force = false): Promise<{ added: number; status: Concept2Status }> {
  const token = await getSetting(tokenKey(userId));
  const meta = await readMeta(userId);
  if (!token) return { added: 0, status: { connected: false, checkedAt: meta.at, error: null } };
  const now = new Date();
  if (!syncDue(meta.at, now, force)) return { added: 0, status: { connected: true, checkedAt: meta.at, error: meta.error } };

  const today = todayISO(now);
  let rows: C2Row[];
  try {
    rows = await fetchRows(token, syncFrom(meta.error ? null : meta.at, today));
  } catch (e) {
    const error = e instanceof Error && e.message === "token" ? TURNED_DOWN : "Couldn't reach Concept2. Try again later.";
    const next = { at: meta.at, error };
    await writeMeta(userId, next);
    return { added: 0, status: { connected: true, checkedAt: next.at, error } };
  }

  const floor = addDays(today, -MAX_BACK_DAYS);
  const fresh = rows.filter((r) => r.dateISO <= today && r.dateISO >= floor);
  const seen = new Set(
    (
      (await prisma.concept2Result.findMany({
        where: { userId, resultId: { in: fresh.map((r) => r.resultId) } },
        select: { resultId: true },
      })) as { resultId: string }[]
    ).map((r) => r.resultId),
  );
  let added = 0;
  const names = new Map<string, string>();
  for (const row of fresh.sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : 0))) {
    if (seen.has(row.resultId)) continue;
    seen.add(row.resultId);
    const name = names.get(row.dateISO) ?? (await rowName(userId, row.dateISO));
    names.set(row.dateISO, name);
    try {
      await takeRow(userId, row, name);
      added++;
    } catch {
      // Taken by a sync running at the same time (the ledger's key): fine.
    }
  }
  const next = { at: now.toISOString(), error: null };
  await writeMeta(userId, next);
  return { added, status: { connected: true, checkedAt: next.at, error: null } };
}

/** The day's Concept2 rows, for the day page. */
export async function concept2Day(userId: string, dateISO: string): Promise<Concept2Day> {
  const [status, rows] = await Promise.all([
    concept2Status(userId),
    prisma.concept2Result.findMany({
      where: { userId, date: toDateColumn(dateISO), dismissed: false, sessionId: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { resultId: true, meters: true, seconds: true, replaced: true, sessionId: true },
    }) as Promise<{ resultId: string; meters: number; seconds: number; replaced: unknown; sessionId: string }[]>,
  ]);
  // A row whose session was deleted from history is gone.
  const alive = new Set(
    (
      (await prisma.workoutSession.findMany({
        where: { userId, id: { in: rows.map((r) => r.sessionId) } },
        select: { id: true },
      })) as { id: string }[]
    ).map((s) => s.id),
  );
  return {
    ...status,
    rows: rows.filter((r) => alive.has(r.sessionId)).map((r) => {
      const hand = r.replaced as HandSnapshot | null;
      const set = hand?.sets?.[0];
      return {
        resultId: r.resultId,
        summary: rowSummary({
          meters: r.meters,
          seconds: r.seconds,
          pace: r.meters > 0 && r.seconds > 0 ? Math.round((r.seconds / (r.meters / 500)) * 10) / 10 : null,
        }),
        replaced: hand
          ? rowSummary({ meters: Math.round(set?.meters ?? 0), seconds: set?.seconds ?? 0, pace: null }) || "Rowing"
          : null,
      };
    }),
  };
}

/** Undo a replace: the hand entry comes back, the Concept2 row goes and stays out. */
export async function undoConcept2(userId: string, resultId: string): Promise<boolean> {
  const r = (await prisma.concept2Result.findUnique({
    where: { userId_resultId: { userId, resultId } },
    select: { date: true, sessionId: true, replaced: true, dismissed: true },
  })) as { date: Date; sessionId: string | null; replaced: unknown; dismissed: boolean } | null;
  if (!r || r.dismissed || !r.replaced) return false;
  const hand = r.replaced as HandSnapshot;
  if (r.sessionId) await prisma.workoutSession.deleteMany({ where: { id: r.sessionId, userId } });
  await prisma.workoutSession.create({
    data: {
      userId,
      date: r.date,
      name: hand.name,
      category: "ROWING",
      finished: true,
      isRest: false,
      notes: hand.notes,
      completedOn: hand.completedOn ? toDateColumn(hand.completedOn) : null,
      intent: hand.intent,
      sets: {
        create: (hand.sets ?? []).map((s) => ({
          setNumber: s.setNumber,
          meters: s.meters,
          seconds: s.seconds,
          distance: s.distance,
          unit: s.unit,
          finished: true,
        })),
      },
    },
  });
  await prisma.concept2Result.update({
    where: { userId_resultId: { userId, resultId } },
    data: { dismissed: true, sessionId: null },
  });
  await settleWorkoutTask(userId, fromDateColumn(r.date), { fallbackComplete: true });
  return true;
}

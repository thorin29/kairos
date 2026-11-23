import "server-only";
import { prisma } from "@/lib/prisma";
import { loadPrefs } from "@/lib/notify-prefs";
import type { NotifyPrefsData } from "@/lib/notify-prefs-shape";

/**
 * News from Kairos to the people who asked for it (v0.773): money waiting
 * for approval and suggested family workouts (parents), a family workout
 * you're in. Each person turns each kind on in their app; best-effort, never
 * blocks the thing that caused it; held by quiet hours.
 */

type Flag = "approvals" | "familyWorkout";

async function nameOf(userId: string | null): Promise<string> {
  if (!userId) return "Someone";
  const u = (await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } })) as {
    name: string;
    displayName: string | null;
  } | null;
  return u ? u.displayName || u.name : "Someone";
}

export async function parentIds(): Promise<string[]> {
  const rows = (await prisma.user.findMany({
    where: { isActive: true, OR: [{ role: "ADMIN" }, { kind: "PARENT" }] },
    select: { id: true },
  })) as { id: string }[];
  return rows.map((r) => r.id);
}

async function tell(
  flag: Flag,
  userIds: string[],
  except: string | null,
  msg: { kind: string; title: string; body: string; link: string },
): Promise<void> {
  try {
    const wants: string[] = [];
    for (const id of new Set(userIds)) {
      if (id === except) continue;
      const prefs: NotifyPrefsData = (await loadPrefs(id)).prefs;
      if (prefs[flag]) wants.push(id);
    }
    if (wants.length === 0) return;
    const { notify } = await import("@/lib/push");
    await notify(wants, msg, { quiet: true });
  } catch {
    // best-effort
  }
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** A money entry waiting for a parent's OK. */
export async function tellMoneyWaiting(entry: {
  userId: string;
  amountCents: number;
  direction: string;
  detail: string | null;
  byId: string | null;
}): Promise<void> {
  const who = await nameOf(entry.userId);
  await tell("approvals", await parentIds(), entry.byId, {
    kind: "approval",
    title: `${who} logged ${dollars(entry.amountCents)}`,
    body: [entry.direction === "PAYMENT" ? "Spent" : "Deposit", entry.detail].filter(Boolean).join(" · ") + " · needs approval",
    link: "/money",
  });
}

/** Someone suggested a family workout; parents decide. */
export async function tellWorkoutSuggested(byId: string, workoutName: string): Promise<void> {
  await tell("approvals", await parentIds(), byId, {
    kind: "approval",
    title: `${await nameOf(byId)} suggested a family workout`,
    body: workoutName,
    link: "/exercise",
  });
}

/** You're in a family workout a parent set. */
export async function tellFamilyWorkout(userIds: string[], byId: string | null, workoutName: string, when: string): Promise<void> {
  await tell("familyWorkout", userIds, byId, {
    kind: "workout",
    title: `Family workout ${when}`,
    body: workoutName,
    link: "/exercise",
  });
}

/**
 * Once a morning (the background timer, from 8 AM household time): each
 * person who asked is told the shared chores where it's most their turn, the
 * same "your turn" the home card shows.
 */
const CHORE_HOUR = 8;
const CHORE_DAY_KEY = "notify.choreTurnDay";

export async function morningChoreTurns(): Promise<void> {
  const { householdTz, todayISO } = await import("@/lib/dates");
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: householdTz(), hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
  if (hour < CHORE_HOUR) return;
  const today = todayISO();
  const { getSetting, setSetting } = await import("@/lib/settings");
  if ((await getSetting(CHORE_DAY_KEY)) === today) return;
  await setSetting(CHORE_DAY_KEY, today);

  const { loadOpenTasks } = await import("@/lib/queries/overview");
  const users = (await prisma.user.findMany({ where: { isActive: true }, select: { id: true } })) as { id: string }[];
  for (const u of users) {
    if (!(await loadPrefs(u.id)).prefs.choreTurn) continue;
    const mine = (await loadOpenTasks(today, u.id)).filter((t) => t.isShared && t.furthestBehind);
    if (mine.length === 0) continue;
    const { notify } = await import("@/lib/push");
    await notify(
      [u.id],
      {
        kind: "chore",
        title: mine.length === 1 ? `Your turn: ${mine[0].title}` : `Your turn: ${mine.length} shared chores`,
        body: mine.map((t) => t.title).join(", ").slice(0, 160),
        link: "/chores",
      },
      { quiet: true },
    );
  }
}
